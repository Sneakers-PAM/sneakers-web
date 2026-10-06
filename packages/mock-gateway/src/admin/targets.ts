import {
  AdminConnectionsDocument,
  AdminDeleteConnectionDocument,
  AdminDeleteTargetDocument,
  AdminSaveConnectionDocument,
  AdminSaveTargetDocument,
  AdminTargetsDocument,
} from "@sneakers-web/api-client";
import { HttpResponse } from "msw";

import type { MockConnection, MockTarget } from "#mock/fixtures/world";

import { isSiteAdmin, notSiteAdmin, refusal } from "#mock/admin/refuse";
import { api, asUser } from "#mock/handlers/graphql";
import { mockState, newToken } from "#mock/state";

const ok = (data: unknown): never => HttpResponse.json({ data } as never) as never;

const asAdmin = <T>(request: Request, run: () => T): T =>
  asUser(request, (actorId) => (isSiteAdmin(actorId) ? run() : (notSiteAdmin() as T)));

const world = () => mockState.world;

const connectionView = (c: MockConnection) => ({
  description: c.description ?? null,
  id: c.id,
  name: c.name,
  port: c.port ?? null,
  protocol: c.protocol,
  targetCount: world().targets.filter((t) => t.connectionId === c.id).length,
  useTls: c.useTls ?? false,
});

const targetView = (t: MockTarget) => ({
  connectionId: t.connectionId,
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

/** An authorized_keys line: a key type, base64 data, and an optional comment. */
const PIN = /^(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp(256|384|521)|sk-\S+) [A-Za-z0-9+/=]+( .*)?$/;

const blank = (v: null | string | undefined) => (v?.trim() ? v.trim() : undefined);

export const targetHandlers = [
  api.query(AdminConnectionsDocument, ({ request }) =>
    asAdmin(request, () =>
      ok({
        connections: world().connections.map((c) => connectionView(c)),
        targets: world().targets.map((t) => ({
          connectionId: t.connectionId,
          id: t.id,
          name: t.name,
        })),
      }),
    ),
  ),

  api.mutation(AdminSaveConnectionDocument, ({ request, variables }) =>
    asAdmin(request, () => {
      const input = variables.input;
      const name = input.name.trim();
      if (!name) return refusal("INVALID_ARGUMENT", "a connection needs a name");
      if (!input.protocol.trim())
        return refusal("INVALID_ARGUMENT", "a connection needs a protocol");
      if (
        input.port !== null &&
        input.port !== undefined &&
        (input.port < 1 || input.port > 65_535)
      )
        return refusal("INVALID_ARGUMENT", "the port must be between 1 and 65535");
      if (
        world().connections.some(
          (c) => c.id !== input.id && c.name.toLowerCase() === name.toLowerCase(),
        )
      )
        return refusal("ALREADY_EXISTS", "a connection with that name already exists");
      const existing = world().connections.find((c) => c.id === input.id);
      if (input.id && !existing) return refusal("NOT_FOUND", "connection not found");
      const saved: MockConnection = {
        description: blank(input.description),
        id: existing?.id ?? newToken("mock-conn"),
        name,
        port: input.port ?? undefined,
        protocol: input.protocol.trim(),
        useTls: !!input.useTls,
      };
      world().connections = existing
        ? world().connections.map((c) => (c.id === saved.id ? saved : c))
        : [...world().connections, saved];
      return ok({ saveConnection: connectionView(saved) });
    }),
  ),

  api.mutation(AdminDeleteConnectionDocument, ({ request, variables }) =>
    asAdmin(request, () => {
      const c = world().connections.find((x) => x.id === variables.id);
      if (!c) return refusal("NOT_FOUND", "connection not found");
      const users = world().targets.filter((t) => t.connectionId === c.id);
      if (users.length > 0)
        return refusal("FAILED_PRECONDITION", `${users.length} targets use this connection`);
      world().connections = world().connections.filter((x) => x.id !== c.id);
      return ok({ deleteConnection: true });
    }),
  ),

  api.query(AdminTargetsDocument, ({ request }) =>
    asAdmin(request, () =>
      ok({
        connections: world().connections.map((c) => ({
          id: c.id,
          name: c.name,
          port: c.port ?? null,
          protocol: c.protocol,
        })),
        targets: world().targets.map((t) => targetView(t)),
      }),
    ),
  ),

  api.mutation(AdminSaveTargetDocument, ({ request, variables }) =>
    asAdmin(request, () => {
      const input = variables.input;
      const name = input.name.trim();
      const hostname = input.hostname.trim();
      if (!name) return refusal("INVALID_ARGUMENT", "a target needs a name");
      if (!hostname) return refusal("INVALID_ARGUMENT", "a target needs a hostname");
      if (!input.connectionId || !world().connections.some((c) => c.id === input.connectionId))
        return refusal("INVALID_ARGUMENT", "pick a connection for the target");
      const existing = world().targets.find((t) => t.id === input.id);
      if (input.id && !existing) return refusal("NOT_FOUND", "target not found");
      const pins = input.sshHostKeys ?? existing?.sshHostKeys ?? [];
      const bad = pins.findIndex((p) => !PIN.test(p.trim()));
      if (bad !== -1)
        return refusal("INVALID_ARGUMENT", `host key ${bad + 1} isn't an OpenSSH public key`);
      const saved: MockTarget = {
        connectionId: input.connectionId,
        description: blank(input.description),
        domain: blank(input.domain),
        hostname,
        id: existing?.id ?? newToken("mock-target"),
        kind: blank(input.kind),
        name,
        ownerUserId: existing?.ownerUserId,
        realm: blank(input.realm),
        sshHostKeys: pins.map((p) => p.trim()),
      };
      world().targets = existing
        ? world().targets.map((t) => (t.id === saved.id ? saved : t))
        : [...world().targets, saved];
      return ok({ saveTarget: targetView(saved) });
    }),
  ),

  api.mutation(AdminDeleteTargetDocument, ({ request, variables }) =>
    asAdmin(request, () => {
      const t = world().targets.find((x) => x.id === variables.id);
      if (!t) return refusal("NOT_FOUND", "target not found");
      const used = targetView(t).secretCount;
      if (used > 0) return refusal("FAILED_PRECONDITION", `${used} secrets point at this target`);
      world().targets = world().targets.filter((x) => x.id !== t.id);
      return ok({ deleteTarget: true });
    }),
  ),
];
