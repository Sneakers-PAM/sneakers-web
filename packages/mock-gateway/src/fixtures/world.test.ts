// @vitest-environment node
import { auth, GatewayClient, ShellCountsDocument } from "@sneakers-web/api-client";

import { initialInbox } from "#mock/fixtures/inbox";
import { USERS } from "#mock/fixtures/users";
import { MOCK_GATEWAY_URL, MOCK_SESSION_COOKIE, mockState, resetMockState } from "#mock/state";
import { sessionCookie, withMockGateway } from "#mock/testing";

withMockGateway();

const world = () => mockState.world;
const ids = (rows: { id: string }[]) => new Set(rows.map((r) => r.id));

describe("the mock world", () => {
  it("is invented: every id starts with mock- and no address or host is real", () => {
    const w = world();
    const rows = [
      ...w.folders,
      ...w.secrets,
      ...w.targets,
      ...w.connections,
      ...w.leases,
      ...w.requests,
      ...w.tokens,
      ...w.secretUses,
      ...w.useGrants,
      ...w.groups,
    ];
    for (const row of rows) expect(row.id).toMatch(/^mock-/);
    for (const t of w.targets) expect(t.hostname).toMatch(/\.example\.(org|com|net)$|^192\.0\.2\./);
  });

  it("holds together: every reference points at something that exists", () => {
    const w = world();
    const folders = ids(w.folders);
    const secrets = ids(w.secrets);
    const types = ids(w.secretTypes);
    const targets = ids(w.targets);
    const users = ids(USERS);
    for (const f of w.folders) if (f.parentId) expect(folders).toContain(f.parentId);
    for (const s of w.secrets) {
      expect(folders).toContain(s.folderId);
      expect(types).toContain(s.typeId);
      if (s.targetId) expect(targets).toContain(s.targetId);
      expect(s.versions.length).toBeGreaterThan(0);
      expect(s.versions.filter((v) => v.active)).toHaveLength(1);
    }
    for (const t of w.targets) expect(ids(w.connections)).toContain(t.connectionId);
    for (const f of w.folders) if (f.groupId) expect(ids(w.groups)).toContain(f.groupId);
    for (const m of w.groupMembers) {
      expect(ids(w.groups)).toContain(m.groupId);
      expect(users).toContain(m.userId);
    }
    for (const l of w.leases) {
      expect(secrets).toContain(l.secretId);
      expect(users).toContain(l.userId);
      const type = w.secretTypes.find(
        (x) => x.id === w.secrets.find((s) => s.id === l.secretId)?.typeId,
      );
      expect(type?.checkout).toBe(true);
    }
    for (const r of w.requests) {
      expect(users).toContain(r.requestedByUserId);
      if (r.kind === "secret_access") expect(secrets).toContain(r.secretId);
      else expect(folders).toContain(r.folderId);
    }
    for (const g of w.useGrants) expect(ids(w.tokens)).toContain(g.tokenId);
    for (const n of initialInbox()) {
      expect(n.resourceKind === "secret" ? secrets : folders).toContain(n.resourceId);
    }
  });

  it("has a secret in every state the dashboard counts", () => {
    const now = Date.now();
    const soon = now + 30 * 86_400_000;
    const live = world().secrets.filter((s) => !s.retired);
    const at = (s: { expiresAt?: string }) => (s.expiresAt ? Date.parse(s.expiresAt) : Number.NaN);
    expect(live.some((s) => at(s) < now)).toBe(true);
    expect(live.some((s) => at(s) >= now && at(s) <= soon)).toBe(true);
    expect(live.some((s) => s.lastHeartbeatResult === "failed")).toBe(true);
    expect(world().secrets.some((s) => s.retired)).toBe(true);
  });

  it("starts fresh after a reset", () => {
    world().secrets = [];
    resetMockState();
    expect(world().secrets.length).toBeGreaterThan(0);
  });

  it("drives the frame's counts", async () => {
    const gw = new GatewayClient({
      baseUrl: MOCK_GATEWAY_URL,
      cookieHeader: sessionCookie("mock-user-alice"),
      sessionCookie: MOCK_SESSION_COOKIE,
    });
    await auth.getSession(gw);
    const d = await gw.gql(ShellCountsDocument, { userId: "mock-user-alice" });
    const mine = world().leases.filter((l) => l.userId === "mock-user-alice" && !l.returned);
    expect(d.activeLeasesForUser.map((l) => l.id)).toEqual(mine.map((l) => l.id));
    expect(d.approvalRequests).toHaveLength(world().requests.length);
    const waiting = world().secretUses.filter(
      (u) => u.ownerUserId === "mock-user-alice" && u.state === "pending",
    );
    expect(d.pendingSecretUses.map((u) => u.id)).toEqual(waiting.map((u) => u.id));

    world().leases.push({ ...mine[0]!, id: "mock-lease-new" });
    const after = await gw.gql(ShellCountsDocument, { userId: "mock-user-alice" });
    expect(after.activeLeasesForUser).toHaveLength(mine.length + 1);
  });
});
