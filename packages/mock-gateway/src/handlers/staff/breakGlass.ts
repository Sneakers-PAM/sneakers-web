import {
  AdminBreakGlassSessionsDocument,
  BreakGlassBrowseDocument,
  BreakGlassCurrentDocument,
  BreakGlassExitDocument,
  BreakGlassOpenDocument,
  BreakGlassOwnersDocument,
} from "@sneakers-web/api-client";
import { HttpResponse } from "msw";

import { isSiteAdmin, refusal } from "#mock/admin/refuse";
import { userById, WRONG_CODE } from "#mock/fixtures/users";
import { authed } from "#mock/handlers/auth";
import { api, asUser } from "#mock/handlers/graphql";
import { mockState, onMockReset } from "#mock/state";

/** How long a break-glass session stays open, as in the vault. */
export const MOCK_BREAK_GLASS_TTL_MS = 15 * 60_000;

export interface MockBreakGlassReveal {
  eventId: string;
  ownerNotified: boolean;
  postRotationScheduled: boolean;
  revealedAt: number;
  secretId: string;
}

export interface MockBreakGlassSession {
  actorUserId: string;
  endedAt?: number;
  endReason?: "exit" | "expired" | "replaced";
  expiresAt: number;
  id: string;
  openedAt: number;
  reason: string;
  reveals: MockBreakGlassReveal[];
  /** The mock session it was opened in, standing in for the gateway's session reference. */
  sessionRef: string;
}

/** Every break-glass session the mock has seen, newest last. */
export const mockBreakGlass = { sessions: [] as MockBreakGlassSession[] };

onMockReset(() => {
  mockBreakGlass.sessions = [];
});

const ok = (data: unknown): never => HttpResponse.json({ data } as never) as never;
const iso = (ms: number) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");

const sessionRefOf = (request: Request) => authed(request)?.csrf ?? "";

const webOnly = () =>
  refusal("PERMISSION_DENIED", "break-glass is for site admins", "BREAK_GLASS_NOT_ADMIN");

/** The vault's refusal of a session that's over, someone else's or from another web session. */
export const breakGlassClosed = () =>
  refusal(
    "FAILED_PRECONDITION",
    "the break-glass session is not open",
    "BREAK_GLASS_SESSION_CLOSED",
  );

const end = (s: MockBreakGlassSession, how: "exit" | "expired" | "replaced", at = Date.now()) => {
  if (s.endedAt !== undefined) return;
  s.endedAt = how === "expired" ? s.expiresAt : at;
  s.endReason = how;
};

/** Close the sessions past their expiry, as the vault's sweep does. */
const sweep = () => {
  for (const s of mockBreakGlass.sessions)
    if (s.endedAt === undefined && Date.now() >= s.expiresAt) end(s, "expired");
};

/** The caller's open session for this request's web session, if any. */
export const liveBreakGlass = (
  request: Request,
  userId: string,
  id?: null | string,
): MockBreakGlassSession | undefined => {
  sweep();
  const ref = sessionRefOf(request);
  return mockBreakGlass.sessions.find(
    (s) =>
      (id === undefined || s.id === id) &&
      s.actorUserId === userId &&
      s.sessionRef === ref &&
      s.endedAt === undefined,
  );
};

const sessionView = (s: MockBreakGlassSession) => ({
  actorName: userById(s.actorUserId)?.name ?? s.actorUserId,
  actorUserId: s.actorUserId,
  endedAt: s.endedAt === undefined ? null : iso(s.endedAt),
  endReason: s.endReason ?? null,
  expiresAt: iso(s.expiresAt),
  id: s.id,
  openedAt: iso(s.openedAt),
  reason: s.reason,
  reveals: s.reveals.map((r) => ({
    eventId: r.eventId,
    ownerNotified: r.ownerNotified,
    postRotationScheduled: r.postRotationScheduled,
    revealedAt: iso(r.revealedAt),
    secretId: r.secretId,
    secretName: mockState.world.secrets.find((x) => x.id === r.secretId)?.name ?? "",
  })),
});

/** Record a reveal made in a session; the caller has checked the session. */
export const recordBreakGlassReveal = (
  s: MockBreakGlassSession,
  secretId: string,
  ownerNotified: boolean,
) => {
  s.reveals.push({
    eventId: `mock-bg-${s.reveals.length + 1}-${s.id}`,
    ownerNotified,
    postRotationScheduled: false,
    revealedAt: Date.now(),
    secretId,
  });
};

/** Break-glass mode, answered with the vault's and gateway's rules. */
export const breakGlassHandlers = [
  api.query(BreakGlassCurrentDocument, ({ request }) =>
    asUser(request, (userId) => {
      if (!isSiteAdmin(userId)) return ok({ breakGlassSession: null });
      const s = liveBreakGlass(request, userId);
      return ok({ breakGlassSession: s ? sessionView(s) : null });
    }),
  ),

  api.mutation(BreakGlassOpenDocument, ({ request, variables }) =>
    asUser(request, (userId) => {
      if (!isSiteAdmin(userId)) return webOnly();
      if (!/^\d{6}$/.test(variables.code) || variables.code === WRONG_CODE)
        return refusal(
          "UNAUTHENTICATED",
          "invalid or missing MFA code",
          "BREAK_GLASS_CODE_INVALID",
        );
      const reason = variables.reason.trim();
      if (!reason) return refusal("INVALID_ARGUMENT", "a reason is required to break glass");
      if ([...reason].length > 500)
        return refusal("INVALID_ARGUMENT", "the reason is longer than 500 characters");
      sweep();
      for (const s of mockBreakGlass.sessions)
        if (s.actorUserId === userId && s.endedAt === undefined) end(s, "replaced");
      const now = Date.now();
      const s: MockBreakGlassSession = {
        actorUserId: userId,
        expiresAt: now + MOCK_BREAK_GLASS_TTL_MS,
        id: `mock-bgs-${mockBreakGlass.sessions.length + 1}`,
        openedAt: now,
        reason,
        reveals: [],
        sessionRef: sessionRefOf(request),
      };
      mockBreakGlass.sessions.push(s);
      return ok({ openBreakGlassSession: sessionView(s) });
    }),
  ),

  api.mutation(BreakGlassExitDocument, ({ request, variables }) =>
    asUser(request, (userId) => {
      if (!isSiteAdmin(userId)) return webOnly();
      sweep();
      const ref = sessionRefOf(request);
      const s = mockBreakGlass.sessions.find(
        (x) => x.id === variables.id && x.actorUserId === userId && x.sessionRef === ref,
      );
      if (!s) return breakGlassClosed();
      end(s, "exit");
      return ok({ closeBreakGlassSession: sessionView(s) });
    }),
  ),

  api.query(BreakGlassBrowseDocument, ({ request, variables }) =>
    asUser(request, (userId) => {
      if (!isSiteAdmin(userId)) return webOnly();
      if (!liveBreakGlass(request, userId, variables.sessionId)) return breakGlassClosed();
      const w = mockState.world;
      return ok({
        breakGlassBrowse: {
          folders: w.folders.map((f) => ({
            id: f.id,
            isMasterPersonal: f.isMasterPersonal ?? false,
            name: f.name,
            order: f.order,
            ownerUserId: f.ownerUserId ?? null,
            parentId: f.parentId ?? null,
            scope: f.scope,
          })),
          secrets: w.secrets
            .filter((s) => !s.retired)
            .map((s) => ({ folderId: s.folderId, id: s.id, name: s.name, typeId: s.typeId })),
        },
        secretTypes: w.secretTypes.map(({ id, name }) => ({ id, name })),
      });
    }),
  ),

  api.query(BreakGlassOwnersDocument, ({ request, variables }) =>
    asUser(request, () =>
      ok({
        resolveUserLabels: [variables.ids]
          .flat()
          .map((id) => ({ id, name: userById(id)?.name ?? id })),
      }),
    ),
  ),

  api.query(AdminBreakGlassSessionsDocument, ({ request, variables }) =>
    asUser(request, (userId) => {
      if (!isSiteAdmin(userId)) return webOnly();
      sweep();
      const limit = variables.limit && variables.limit > 0 ? Math.min(variables.limit, 200) : 50;
      return ok({
        breakGlassSessions: mockBreakGlass.sessions
          .toReversed()
          .slice(0, limit)
          .map((s) => sessionView(s)),
      });
    }),
  ),
];
