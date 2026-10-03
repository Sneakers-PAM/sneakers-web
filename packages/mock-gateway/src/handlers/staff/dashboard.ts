import {
  DashboardHomeDocument,
  DashboardSecretNameDocument,
  DashboardSecretsByStatusDocument,
} from "@sneakers-web/api-client";
import { HttpResponse, type RequestHandler } from "msw";

import type { MockFolder, MockSecret } from "#mock/fixtures/world";

import { refusal } from "#mock/admin/refuse";
import { api, asUser } from "#mock/handlers/graphql";
import { mockState } from "#mock/state";

const EXPIRING_WINDOW_MS = 30 * 86_400_000;

type Status = "all" | "drift" | "expired" | "expiring";
const STATUSES = new Set<string>(["all", "drift", "expired", "expiring"]);

/** Shared (group and role) folders, plus the caller's own personal folders. */
const folderVisible = (folder: MockFolder | undefined, userId: string): boolean =>
  !!folder && (folder.scope !== "personal" || folder.ownerUserId === userId);

const readableFolders = (userId: string) =>
  mockState.world.folders.filter((f) => folderVisible(f, userId));

/** The caller's readable live secrets: retired and locked (canRead false) ones never count. */
const readableSecrets = (userId: string): MockSecret[] => {
  const folders = new Map(mockState.world.folders.map((f) => [f.id, f]));
  return mockState.world.secrets.filter(
    (s) => !s.retired && s.canRead && folderVisible(folders.get(s.folderId), userId),
  );
};

const matches = (s: MockSecret, status: Status, now: number): boolean => {
  const expires = s.expiresAt ? Date.parse(s.expiresAt) : Number.NaN;
  if (status === "expired") return expires < now;
  if (status === "expiring") return expires >= now && expires <= now + EXPIRING_WINDOW_MS;
  if (status === "drift")
    return s.lastHeartbeatResult === "failed" || s.lastHeartbeatResult === "unreachable";
  return true;
};

/** A secret as the gateway lists it: metadata only. Field values never leave a reveal. */
const listed = (s: MockSecret) => ({
  expiresAt: s.expiresAt ?? null,
  folderId: s.folderId,
  heartbeatOptOut: s.heartbeatOptOut,
  id: s.id,
  lastAccessedAt: s.lastAccessedAt ?? null,
  lastHeartbeatResult: s.lastHeartbeatResult ?? null,
  name: s.name,
  targetId: s.targetId ?? null,
  typeId: s.typeId,
  viewCount: s.viewCount,
});

const folderRow = ({ id, name, parentId }: MockFolder) => ({
  id,
  name,
  parentId: parentId ?? null,
});

/** Mock answers for the dashboard and the secrets-by-status list (S1). */
export const dashboardHandlers: RequestHandler[] = [
  api.query(DashboardHomeDocument, ({ request, variables }) =>
    asUser(request, (userId) => {
      const now = Date.now();
      const { leases, requests, secretUses } = mockState.world;
      const mine = readableSecrets(userId);
      const count = (status: Status) => mine.filter((s) => matches(s, status, now)).length;
      return HttpResponse.json({
        data: {
          activeLeasesForUser: leases
            .filter((l) => l.userId === variables.userId && !l.returned)
            .map(({ expiresAt, id, issuedAt, secretId }) => ({
              expiresAt,
              id,
              issuedAt,
              secretId,
            })),
          approvalRequests: requests.map((r) => ({
            comments: r.comments.map(({ id }) => ({ id })),
            folderName: r.folderName,
            id: r.id,
            kind: r.kind,
            requestedAt: r.requestedAt,
            requestedByUserId: r.requestedByUserId,
            status: r.status,
          })),
          folders: readableFolders(userId).map((f) => folderRow(f)),
          pendingSecretUses: secretUses
            .filter((u) => u.ownerUserId === userId && u.state === "pending")
            .map(({ argv, clientLabel, expiresAtUnix, fieldKey, id, reveal, secretName }) => ({
              argv,
              clientLabel,
              expiresAtUnix,
              fieldKey,
              id,
              reveal,
              secretName,
            })),
          secretStats: {
            drift: count("drift"),
            expired: count("expired"),
            expiringSoon: count("expiring"),
            total: mine.length,
          },
          topAccessedSecrets: mine
            .filter((s) => s.viewCount > 0)
            .toSorted((a, b) => b.viewCount - a.viewCount || a.name.localeCompare(b.name))
            .slice(0, variables.limit ?? 10)
            .map((s) => listed(s)),
        },
      });
    }),
  ),

  api.query(DashboardSecretNameDocument, ({ request, variables }) =>
    asUser(request, (userId) => {
      const s = readableSecrets(userId).find((x) => x.id === variables.id);
      return HttpResponse.json({ data: { secret: s ? { id: s.id, name: s.name } : null } });
    }),
  ),

  api.query(DashboardSecretsByStatusDocument, ({ request, variables }) =>
    asUser(request, (userId) => {
      if (!STATUSES.has(variables.status))
        return refusal("INVALID_ARGUMENT", `unknown status "${variables.status}"`);
      const now = Date.now();
      return HttpResponse.json({
        data: {
          folders: readableFolders(userId).map((f) => folderRow(f)),
          secretsByStatus: readableSecrets(userId)
            .filter((s) => matches(s, variables.status as Status, now))
            .map((s) => listed(s)),
          secretTypes: mockState.world.secretTypes.map(({ id, name }) => ({ id, name })),
        },
      });
    }),
  ),
];
