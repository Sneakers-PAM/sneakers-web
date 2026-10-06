import {
  AgentsBeginFactorPasskeyDocument,
  AgentsCreateGrantDocument,
  AgentsDecideUseDocument,
  AgentsGrantsDocument,
  AgentsPendingUsesDocument,
  AgentsRevokeGrantDocument,
  AgentsRevokeTokenDocument,
  AgentsSendFactorEmailDocument,
  AgentsTokensDocument,
  type FactorInput,
} from "@sneakers-web/api-client";
import { http, HttpResponse, type RequestHandler } from "msw";

import type { MockSecretUse, MockToken, MockUseGrant } from "#mock/fixtures/world";

import { refusal } from "#mock/admin/refuse";
import { agentsState, consentRequest } from "#mock/fixtures/staff/agents";
import { WRONG_CODE } from "#mock/fixtures/users";
import { userById } from "#mock/fixtures/users";
import { authed } from "#mock/handlers/auth";
import { api, asUser } from "#mock/handlers/graphql";
import { canRead, secretById } from "#mock/handlers/staff/access";
import { mayDecide } from "#mock/handlers/staff/approval";
import { freshMfa } from "#mock/handlers/stepUp";
import { MOCK_GATEWAY_URL, mockState, newToken } from "#mock/state";

// The vault's windows: an approved use must be redeemed within a minute; a grant lasts 24 hours at most.
const REDEEM_AFTER_APPROVAL_S = 60;
const GRANT_MAX_SPAN_S = 24 * 3600;

const ok = (data: unknown): never => HttpResponse.json({ data } as never) as never;

/**
 * The gateway's own checks (the factor, token ownership) fail with a plain error: no code,
 * no reason, just the text.
 */
const plainError = (message: string): never =>
  HttpResponse.json({ errors: [{ message }] } as never) as never;

const world = () => mockState.world;
const nowUnix = () => Math.floor(Date.now() / 1000);

/** Any 6-digit code but the wrong one passes, as at sign-in. The mock has no passkeys. */
const factorOk = (f: FactorInput | null | undefined): boolean =>
  !!f &&
  (f.kind === "totp" || f.kind === "email") &&
  /^\d{6}$/.test(f.code ?? "") &&
  f.code !== WRONG_CODE;

/** Like the gateway's requireFactor: refuse before the vault is asked. */
const factorRefusal = (f: FactorInput | null | undefined): never | null => {
  if (!f) return plainError("a fresh second factor is required");
  if (!factorOk(f)) return plainError("second factor was not accepted");
  return null;
};

/** A pending or approved use past its time is expired, as the vault marks it on read. */
const sweep = () => {
  const now = nowUnix();
  for (const u of world().secretUses) {
    if ((u.state === "pending" || u.state === "approved") && now >= u.expiresAtUnix)
      u.state = "expired";
  }
};

const useView = (u: MockSecretUse) => ({
  argv: [...u.argv],
  clientLabel: u.clientLabel,
  confirm: !!u.confirm,
  expiresAtUnix: u.expiresAtUnix,
  fieldKey: u.fieldKey,
  id: u.id,
  requestedBy: userById(u.ownerUserId)?.name ?? u.ownerUserId,
  reveal: u.reveal,
  runId: u.runId ?? null,
  secretName: u.secretName,
  state: u.state.toUpperCase(),
});

/** Whether `userId` may decide `u` now: an owner or approver of its secret, never its requester. */
const decides = (userId: string, u: MockSecretUse): boolean => {
  const s = secretById(u.secretId);
  return !!s && mayDecide(userId, s, u.ownerUserId);
};

const tokenView = (t: MockToken) => ({
  clientName: t.clientName,
  createdAtUnix: t.createdAtUnix,
  expiresAtUnix: t.expiresAtUnix,
  id: t.id,
  label: t.label,
  lastUsedAtUnix: t.lastUsedAtUnix,
  revokedAtUnix: t.revokedAtUnix,
});

const grantView = (g: MockUseGrant) => ({
  allowReveal: g.allowReveal,
  expiresAtUnix: g.expiresAtUnix,
  fieldKeys: [...g.fieldKeys],
  folderId: g.folderId ?? null,
  id: g.id,
  maxUses: g.maxUses,
  programs: g.programs.map((p) => ({ argPattern: p.args.join(" "), program: p.path })),
  revokedAtUnix: g.revokedAtUnix,
  secretIds: [...g.secretIds],
  tokenId: g.tokenId,
  uses: g.uses,
});

const myTokens = (userId: string) => world().tokens.filter((t) => t.ownerUserId === userId);

/** Shared folders, plus the caller's own personal ones. */
const visibleFolders = (userId: string) =>
  world().folders.filter((f) => f.scope !== "personal" || f.ownerUserId === userId);

/** A bare command name, or an absolute path already in clean form (no "//", ".", ".." or trailing "/"). */
const validProgram = (p: string) =>
  !p.includes("/") ||
  (p.startsWith("/") &&
    p
      .slice(1)
      .split("/")
      .every((part) => part !== "" && part !== "." && part !== ".."));

const grantProblem = (input: {
  allowReveal?: boolean | null;
  expiresAtUnix: number;
  folderId?: null | string;
  programs: { argPattern: string; program: string }[];
  secretIds?: null | string[];
  tokenId: string;
}): null | string => {
  const now = nowUnix();
  if (!input.tokenId) return "a grant is for one personal token";
  if (!input.secretIds?.length && !input.folderId) return "a grant needs secrets or a folder";
  if (input.programs.length === 0 && !input.allowReveal)
    return "a grant needs at least one allowed program or allow_reveal";
  if (input.expiresAtUnix <= now || input.expiresAtUnix > now + GRANT_MAX_SPAN_S)
    return "a grant must expire within 24 hours";
  const bad = input.programs.find((p) => !validProgram(p.program));
  if (bad) return `program "${bad.program}" must be a bare command name or a clean absolute path`;
  return null;
};

const at = (path: string) => `${MOCK_GATEWAY_URL}${path}`;
const restRefuse = (status: number, error: string) =>
  HttpResponse.json({ error } as never, { status });

const liveConsent = (id: string) => {
  const c = consentRequest(id);
  return c && Date.now() < c.expiresAt ? c : undefined;
};

const withQuery = (target: string, parameters: Record<string, string>) => {
  const u = new URL(target);
  for (const [k, v] of Object.entries(parameters)) u.searchParams.set(k, v);
  return u.toString();
};

/** Mock answers for agent access: tokens, use approvals, use grants and consent (S5). */
export const agentsHandlers: RequestHandler[] = [
  api.query(AgentsTokensDocument, ({ request }) =>
    asUser(request, (userId) => ok({ myTokens: myTokens(userId).map((t) => tokenView(t)) })),
  ),

  api.mutation(AgentsRevokeTokenDocument, ({ request, variables }) =>
    asUser(request, (userId) => {
      const t = myTokens(userId).find((x) => x.id === variables.id);
      if (!t) return refusal("NOT_FOUND", "token not found");
      if (!t.revokedAtUnix) t.revokedAtUnix = nowUnix();
      return ok({ revokeMyToken: tokenView(t) });
    }),
  ),

  api.query(AgentsPendingUsesDocument, ({ request }) =>
    asUser(request, (userId) => {
      sweep();
      return ok({
        pendingSecretUses: world()
          .secretUses.filter((u) => u.ownerUserId === userId && u.state === "pending")
          .map((u) => useView(u)),
        secretUsesToDecide: world()
          .secretUses.filter((u) => u.state === "pending" && decides(userId, u))
          .map((u) => useView(u)),
      });
    }),
  ),

  api.mutation(AgentsDecideUseDocument, ({ request, variables }) =>
    asUser(request, (userId) => {
      if (variables.approve && (variables.factor || !freshMfa(request))) {
        const refused = factorRefusal(variables.factor);
        if (refused) return refused;
      }
      sweep();
      const u = world().secretUses.find((x) => x.id === variables.id);
      if (!u) return refusal("NOT_FOUND", "secret use not found");
      const own = u.ownerUserId === userId;
      if (own && variables.approve)
        return refusal("PERMISSION_DENIED", "you can't approve your own request", "SELF_APPROVAL");
      if (!own && !decides(userId, u))
        return refusal(
          "PERMISSION_DENIED",
          "only an owner or approver of this secret can decide this use",
          "NOT_APPROVER",
        );
      if (u.state !== "pending")
        return refusal(
          "FAILED_PRECONDITION",
          `secret use is SECRET_USE_STATE_${u.state.toUpperCase()}`,
        );
      if (variables.approve) {
        u.state = "approved";
        u.expiresAtUnix = nowUnix() + REDEEM_AFTER_APPROVAL_S;
      } else {
        u.state = "denied";
      }
      return ok({ decideSecretUse: useView(u) });
    }),
  ),

  api.query(AgentsGrantsDocument, ({ request }) =>
    asUser(request, (userId) => {
      const folders = visibleFolders(userId);
      const folderIds = new Set(folders.map((f) => f.id));
      return ok({
        folders: folders.map(({ id, name, parentId }) => ({
          id,
          name,
          parentId: parentId ?? null,
        })),
        myTokens: myTokens(userId).map((t) => tokenView(t)),
        secretsByStatus: world()
          .secrets.filter((s) => !s.retired && folderIds.has(s.folderId) && canRead(userId, s))
          .map(({ folderId, id, name, typeId }) => ({ folderId, id, name, typeId })),
        secretTypes: world().secretTypes.map((t) => ({
          fields: t.fields.map(({ key, label, sensitive }) => ({
            key,
            label,
            sensitive: sensitive ?? false,
          })),
          id: t.id,
        })),
        useGrants: world()
          .useGrants.filter((g) => g.ownerUserId === userId)
          .map((g) => grantView(g)),
      });
    }),
  ),

  api.mutation(AgentsCreateGrantDocument, ({ request, variables }) =>
    asUser(request, (userId) => {
      const { factor, input } = variables;
      const owned = myTokens(userId).some((t) => t.id === input.tokenId && !t.revokedAtUnix);
      if (!owned) return plainError("grants can only be made for your own active tokens");
      const refused = factorRefusal(factor);
      if (refused) return refused;
      const problem = grantProblem(input);
      if (problem) return refusal("INVALID_ARGUMENT", problem);
      const g: MockUseGrant = {
        allowReveal: input.allowReveal ?? false,
        expiresAtUnix: input.expiresAtUnix,
        fieldKeys: input.fieldKeys ?? [],
        folderId: input.folderId ?? undefined,
        id: newToken("mock-grant"),
        maxUses: input.maxUses ?? 0,
        ownerUserId: userId,
        programs: input.programs.map((p) => ({
          args: p.argPattern ? p.argPattern.split(" ") : [],
          path: p.program,
        })),
        revokedAtUnix: 0,
        secretIds: input.secretIds ?? [],
        tokenId: input.tokenId,
        uses: 0,
      };
      world().useGrants.push(g);
      return ok({ createUseGrant: grantView(g) });
    }),
  ),

  api.mutation(AgentsRevokeGrantDocument, ({ request, variables }) =>
    asUser(request, (userId) => {
      const g = world().useGrants.find((x) => x.id === variables.id && x.ownerUserId === userId);
      if (!g) return refusal("NOT_FOUND", "use grant not found");
      if (!g.revokedAtUnix) g.revokedAtUnix = nowUnix();
      return ok({ revokeUseGrant: grantView(g) });
    }),
  ),

  api.mutation(AgentsSendFactorEmailDocument, ({ request }) =>
    asUser(request, () => ok({ sendMfaEmailCode: true })),
  ),

  api.mutation(AgentsBeginFactorPasskeyDocument, ({ request }) =>
    asUser(request, () => refusal("FAILED_PRECONDITION", "no passkey is registered")),
  ),

  http.get(at("/oauth2/consent/:id"), ({ params, request }) => {
    if (!authed(request)) return restRefuse(401, "no_session");
    const c = liveConsent(String(params.id));
    if (!c) return restRefuse(404, "request_expired");
    return HttpResponse.json({
      clientName: c.clientName,
      factorRequired: !freshMfa(request),
      redirectHost: new URL(c.redirectUri).host,
    });
  }),

  http.post(at("/oauth2/consent/:id"), async ({ params, request }) => {
    const s = authed(request);
    if (!s) return restRefuse(401, "no_session");
    const body = (await request.json().catch(() => null)) as {
      approve?: boolean;
      factor?: FactorInput;
      label?: string;
    } | null;
    if (!body) return restRefuse(400, "invalid_request");
    const id = String(params.id);
    const c = liveConsent(id);
    if (!c) return restRefuse(404, "request_expired");
    if (!body.approve) {
      agentsState.consents.delete(id);
      return HttpResponse.json({
        redirect: withQuery(c.redirectUri, { error: "access_denied", state: c.state }),
      });
    }
    // Like the gateway: no factor given means the session's must be within MFA_MAX_AGE.
    const given = !!body.factor && Object.values(body.factor).some(Boolean);
    if (!given && !freshMfa(request)) return restRefuse(403, "step_up_required");
    if (given && !factorOk(body.factor)) return restRefuse(401, "invalid_code");
    agentsState.consents.delete(id);
    // The gateway mints the token when the app swaps the code; the mock has no app, so it mints now.
    const now = nowUnix();
    world().tokens.push({
      clientName: c.clientName,
      createdAtUnix: now,
      expiresAtUnix: 0,
      id: newToken("mock-token"),
      label: body.label?.trim() ?? "",
      lastUsedAtUnix: 0,
      ownerUserId: s.userId,
      revokedAtUnix: 0,
    });
    return HttpResponse.json({
      redirect: withQuery(c.redirectUri, { code: newToken("mock-code"), state: c.state }),
    });
  }),

  http.post(at("/oauth2/consent/:id/email-code"), ({ params, request }) => {
    if (!authed(request)) return restRefuse(401, "no_session");
    if (!liveConsent(String(params.id))) return restRefuse(404, "request_expired");
    return HttpResponse.json({ status: "sent" });
  }),

  http.post(at("/oauth2/consent/:id/passkey/begin"), ({ params, request }) => {
    if (!authed(request)) return restRefuse(401, "no_session");
    if (!liveConsent(String(params.id))) return restRefuse(404, "request_expired");
    return restRefuse(502, "identity_unreachable");
  }),
];
