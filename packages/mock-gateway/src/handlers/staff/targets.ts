import type { RequestHandler } from "msw";

import {
  TargetsDeleteDocument,
  TargetsListDocument,
  TargetsOpenSshSessionDocument,
  TargetsSaveDocument,
  TargetsTerminalDocument,
  TargetsTerminalFieldsDocument,
} from "@sneakers-web/api-client";
import { HttpResponse } from "msw";

import type {
  MockConnection,
  MockSecret,
  MockTarget,
  MockTargetConnection,
} from "#mock/fixtures/world";

import { isSiteAdmin, refusal } from "#mock/admin/refuse";
import { api, asUser } from "#mock/handlers/graphql";
import { canRead, canSee, secretById } from "#mock/handlers/staff/access";
import { mockState, newToken } from "#mock/state";

/*
 * Staff targets and the SSH terminal, answered the way the vault and gateway do: a user sees
 * shared targets and their own personal ones (a site admin sees all), creates personal ones (a
 * site admin's are shared), and edits or deletes only their own unless a site admin. Only a
 * site admin changes host-key pins.
 */

const SSH_KEY_TYPE = "type-ssh-key";
// The gateway asks the broker for a 30-second ticket.
const TICKET_TTL_S = 30;

const ok = (data: unknown): never => HttpResponse.json({ data } as never) as never;
const world = () => mockState.world;

const visible = (userId: string, t: MockTarget) =>
  isSiteAdmin(userId) || !t.ownerUserId || t.ownerUserId === userId;

const canEdit = (userId: string, t: MockTarget) =>
  isSiteAdmin(userId) || (!!t.ownerUserId && t.ownerUserId === userId);

/** A target's connections, same as the vault's own migration: its own list when it has one, or
 * a one-item default list built from the legacy connectionId. */
const connectionsOf = (t: MockTarget): MockTargetConnection[] =>
  t.connections && t.connections.length > 0
    ? t.connections
    : [{ connectionId: t.connectionId, isDefault: true }];

const defaultConnectionId = (t: MockTarget): string =>
  connectionsOf(t).find((c) => c.isDefault)?.connectionId ?? t.connectionId;

const targetView = (t: MockTarget) => ({
  connectionId: defaultConnectionId(t),
  connections: connectionsOf(t),
  description: t.description ?? null,
  domain: t.domain ?? null,
  hostname: t.hostname,
  id: t.id,
  kind: t.kind ?? null,
  name: t.name,
  ownerUserId: t.ownerUserId ?? null,
  realm: t.realm ?? null,
  secretCount: world().secrets.filter((s) => s.targetId === t.id && !s.retired).length,
  sshHostKeys: t.sshHostKeys,
});

/** The save input's connections, normalized from the new list or the legacy single
 * connectionId; null when neither names a connection (refused). */
const connectionsFromInput = (input: {
  connectionId?: null | string;
  connections?: { connectionId: string; isDefault: boolean }[] | null;
}): MockTargetConnection[] | null => {
  if (input.connections && input.connections.length > 0) return input.connections;
  if (input.connectionId) return [{ connectionId: input.connectionId, isDefault: true }];
  return null;
};

/** Why the vault would refuse this connection list, or null when it's fine: every id must
 * resolve, no two sharing a protocol, exactly one default. */
const connectionsProblem = (connections: MockTargetConnection[]): never | null => {
  if (connections.some((c) => !world().connections.some((wc) => wc.id === c.connectionId)))
    return refusal("NOT_FOUND", "connection not found");
  const protocols = connections.map(
    (c) => world().connections.find((wc) => wc.id === c.connectionId)!.protocol,
  );
  if (new Set(protocols).size !== protocols.length)
    return refusal("INVALID_ARGUMENT", "a target can't use the same protocol twice");
  if (connections.filter((c) => c.isDefault).length !== 1)
    return refusal("INVALID_ARGUMENT", "exactly one connection must be the default");
  return null;
};

const connectionView = (c: MockConnection) => ({
  description: c.description ?? null,
  id: c.id,
  name: c.name,
  port: c.port ?? null,
  protocol: c.protocol,
});

const blank = (v: null | string | undefined) => (v?.trim() ? v.trim() : undefined);

const sameList = (a: string[], b: string[]) =>
  a.length === b.length && a.every((v, index) => v === b[index]);

const noEdit = () => refusal("PERMISSION_DENIED", "not permitted to edit this target");
const noPins = () =>
  refusal("PERMISSION_DENIED", "only a site admin may change a target's SSH host keys");

const nonSensitive = (s: MockSecret) => {
  const type = world().secretTypes.find((t) => t.id === s.typeId);
  return Object.entries(s.fields)
    .filter(([key]) => {
      const f = type?.fields.find((x) => x.key === key);
      return !f || (f.kind !== "password" && !f.sensitive && !f.superSensitive);
    })
    .map(([key, value]) => ({ key, value }));
};

/** Why the gateway won't open a session for `s`, or null when it will. */
const sessionProblem = (userId: string, s: MockSecret): never | null => {
  if (!canRead(userId, s))
    return refusal("PERMISSION_DENIED", "not permitted to read this secret", "NO_ACCESS");
  if (s.retired) return refusal("FAILED_PRECONDITION", "secret is retired", "RETIRED");
  if (s.typeId !== SSH_KEY_TYPE) return refusal("FAILED_PRECONDITION", "secret is not an SSH key");
  if (!s.targetId) return refusal("FAILED_PRECONDITION", "secret has no target host");
  const t = world().targets.find((x) => x.id === s.targetId && visible(userId, x));
  if (!t) return refusal("NOT_FOUND", "target not found");
  const c = world().connections.find((x) => x.id === t.connectionId);
  if (!c) return refusal("NOT_FOUND", "connection not found");
  if (c.protocol !== "ssh") return refusal("FAILED_PRECONDITION", "connection is not ssh");
  return null;
};

export const targetsHandlers: RequestHandler[] = [
  api.query(TargetsListDocument, ({ request }) =>
    asUser(request, (userId) =>
      ok({
        connections: world().connections.map((c) => connectionView(c)),
        targets: world()
          .targets.filter((t) => visible(userId, t))
          .map((t) => targetView(t)),
      }),
    ),
  ),

  api.mutation(TargetsSaveDocument, ({ request, variables }) =>
    asUser(request, (userId) => {
      const input = variables.input;
      const name = input.name.trim();
      const hostname = input.hostname.trim();
      const connections = connectionsFromInput(input);
      if (!name || !hostname || !connections)
        return refusal("INVALID_ARGUMENT", "target name, hostname, and a connection are required");
      const problem = connectionsProblem(connections);
      if (problem) return problem;
      const admin = isSiteAdmin(userId);
      const existing = input.id ? world().targets.find((t) => t.id === input.id) : undefined;
      if (input.id && !existing) return refusal("NOT_FOUND", "target not found");
      if (existing && !canEdit(userId, existing)) return noEdit();
      const pins = input.sshHostKeys ?? existing?.sshHostKeys ?? [];
      if (!admin && !sameList(pins, existing?.sshHostKeys ?? [])) return noPins();
      const saved: MockTarget = {
        connectionId: connections.find((c) => c.isDefault)!.connectionId,
        connections,
        description: blank(input.description),
        domain: blank(input.domain),
        hostname,
        id: existing?.id ?? newToken("mock-target"),
        kind: blank(input.kind),
        name,
        ownerUserId: existing ? existing.ownerUserId : admin ? undefined : userId,
        realm: blank(input.realm),
        sshHostKeys: pins,
      };
      world().targets = existing
        ? world().targets.map((t) => (t.id === saved.id ? saved : t))
        : [...world().targets, saved];
      return ok({ saveTarget: targetView(saved) });
    }),
  ),

  api.mutation(TargetsDeleteDocument, ({ request, variables }) =>
    asUser(request, (userId) => {
      const t = world().targets.find((x) => x.id === variables.id);
      if (t && !canEdit(userId, t))
        return refusal("PERMISSION_DENIED", "not permitted to delete this target");
      // The vault answers false, not a refusal, while any secret (retired ones too) points at it.
      if (world().secrets.some((s) => s.targetId === variables.id))
        return ok({ deleteTarget: false });
      world().targets = world().targets.filter((x) => x.id !== variables.id);
      return ok({ deleteTarget: true });
    }),
  ),

  api.query(TargetsTerminalDocument, ({ request, variables }) =>
    asUser(request, (userId) => {
      const s = secretById(variables.id);
      return ok({
        connections: world().connections.map((c) => ({
          id: c.id,
          port: c.port ?? null,
          protocol: c.protocol,
        })),
        secret:
          s && canSee(userId, s)
            ? {
                canRead: canRead(userId, s),
                id: s.id,
                name: s.name,
                retired: s.retired,
                targetId: s.targetId ?? null,
                typeId: s.typeId,
              }
            : null,
        targets: world()
          .targets.filter((t) => visible(userId, t))
          .map((t) => ({
            connectionId: t.connectionId,
            hostname: t.hostname,
            id: t.id,
            name: t.name,
            sshHostKeys: t.sshHostKeys,
          })),
      });
    }),
  ),

  api.query(TargetsTerminalFieldsDocument, ({ request, variables }) =>
    asUser(request, (userId) => {
      const s = secretById(variables.id);
      if (!s || !canSee(userId, s)) return refusal("NOT_FOUND", "secret not found");
      if (!canRead(userId, s))
        return refusal("PERMISSION_DENIED", "not permitted to read this secret", "NO_ACCESS");
      return ok({ secretFields: nonSensitive(s) });
    }),
  ),

  api.mutation(TargetsOpenSshSessionDocument, ({ request, variables }) =>
    asUser(request, (userId) => {
      const s = secretById(variables.secretId);
      if (!s || !canSee(userId, s)) return refusal("NOT_FOUND", "secret not found");
      const problem = sessionProblem(userId, s);
      if (problem) return problem;
      return ok({
        openSshSession: {
          expiresInSeconds: TICKET_TTL_S,
          sessionId: newToken("mock-ssh-session"),
          ticket: newToken("mock-ticket"),
          wsUrl: "mock-ssh://mock-gateway.example.invalid/ssh/session",
        },
      });
    }),
  ),
];
