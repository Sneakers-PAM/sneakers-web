// @vitest-environment node
import { mockState } from "@sneakers-web/mock-gateway";
import {
  appRequest,
  form,
  sessionCookie,
  withMockGateway,
} from "@sneakers-web/mock-gateway/testing";

import {
  loadTargetEditor,
  loadTargets,
  saveTargetAction,
  targetsAction,
} from "@/features/targets/targets.server";

withMockGateway();

const BOB = "mock-user-bob";

const get = (path: string, user = "mock-user-alice") =>
  appRequest(path, { cookie: sessionCookie(user) });
const post = (path: string, fields: Record<string, string | string[]>, user = "mock-user-alice") =>
  appRequest(path, { body: form(fields), cookie: sessionCookie(user), method: "POST" });

const bobsTarget = () =>
  mockState.world.targets.push({
    connectionId: "mock-conn-ssh",
    hostname: "192.0.2.20",
    id: "mock-target-bob-nas",
    name: "Bob's NAS",
    ownerUserId: BOB,
    sshHostKeys: [],
  });

const status = async (p: Promise<unknown>) => {
  const thrown = await p.then(
    () => null,
    (error: unknown) => error,
  );
  expect(thrown).toBeInstanceOf(Response);
  return (thrown as Response).status;
};

describe("the targets loader", () => {
  it("lists targets with their scope, connection and use, and who may change each", async () => {
    bobsTarget();
    const d = await loadTargets(get("/targets", BOB));
    expect(d.canCreate).toBe(true);
    expect(d.rows.map((r) => [r.name, r.scope, r.connection, r.secretCount, r.canManage])).toEqual([
      ["Corp directory", "shared", "LDAPS", 2, false],
      ["Edge router", "shared", "SSH", 1, false],
      ["Primary database", "shared", "PostgreSQL", 2, false],
      ["Bob's NAS", "personal", "SSH", 0, true],
    ]);
  });

  it("lets a site admin manage shared targets too", async () => {
    const d = await loadTargets(get("/targets"));
    expect(d.rows.every((r) => r.canManage)).toBe(true);
    expect(d.rows.find((r) => r.name === "Build host")?.scope).toBe("personal");
  });

  it("can't create a target while there are no connections", async () => {
    mockState.world.connections = [];
    const { canCreate } = await loadTargets(get("/targets", BOB));
    expect(canCreate).toBe(false);
  });
});

describe("the targets action", () => {
  it("deletes an unused target the user owns", async () => {
    bobsTarget();
    const r = await targetsAction(
      post("/targets", { id: "mock-target-bob-nas", intent: "delete", name: "Bob's NAS" }, BOB),
    );
    expect(r).toEqual({ done: "Deleted Bob's NAS.", intent: "delete", ok: true });
    expect(mockState.world.targets.some((t) => t.id === "mock-target-bob-nas")).toBe(false);
  });

  it("says when a target is still in use", async () => {
    const r = await targetsAction(
      post("/targets", { id: "mock-target-db1", intent: "delete", name: "Primary database" }),
    );
    expect(r).toEqual({ intent: "delete", inUse: true, ok: false, refusal: null });
  });

  it("returns the refusal for a target the user can't change", async () => {
    const r = await targetsAction(
      post("/targets", { id: "mock-target-db1", intent: "delete", name: "Primary database" }, BOB),
    );
    expect(r).toMatchObject({ ok: false, refusal: { code: "PERMISSION_DENIED" } });
  });
});

describe("the target editor", () => {
  it("starts a new target on the first connection, and names the shared targets", async () => {
    const d = await loadTargetEditor(get("/targets/new", BOB));
    expect(d.target).toBeNull();
    expect(d.draft).toMatchObject({
      connections: [{ connectionId: "mock-conn-ldaps", isDefault: true }],
      name: "",
    });
    expect(d.connections.map((c) => c.label)).toEqual([
      "LDAPS · ldap · 636",
      "SSH · ssh · 22",
      "PostgreSQL · postgres · 5432",
    ]);
    expect(d.sharedNames).toEqual(["Corp directory", "Edge router", "Primary database"]);
  });

  it("loads the user's own target", async () => {
    const d = await loadTargetEditor(get("/targets/mock-target-build1"), "mock-target-build1");
    expect(d.target).toEqual({ id: "mock-target-build1", scope: "personal", secretCount: 1 });
    expect(d.draft).toMatchObject({ hostname: "build1.example.org", kind: "linux" });
    expect(d.sharedNames).toEqual([]);
  });

  it("answers 404 for a target the user can't see, 403 for one they can't change", async () => {
    bobsTarget();
    expect(
      await status(loadTargetEditor(get("/targets/x", "mock-user-dave"), "mock-target-bob-nas")),
    ).toBe(404);
    expect(await status(loadTargetEditor(get("/targets/x", BOB), "mock-target-db1"))).toBe(403);
  });

  it("creates a personal target and goes back to the list", async () => {
    const r = await status(
      saveTargetAction(
        post(
          "/targets/new",
          {
            connectionId: "mock-conn-ssh",
            description: "",
            domain: "",
            hostname: " nas.example.org ",
            kind: "",
            name: "Home NAS",
            realm: "",
          },
          BOB,
        ),
      ),
    );
    expect(r).toBe(302);
    expect(mockState.world.targets.at(-1)).toMatchObject({
      hostname: "nas.example.org",
      name: "Home NAS",
      ownerUserId: BOB,
    });
  });

  it("saves an edit and keeps the target's pins", async () => {
    await status(
      saveTargetAction(
        post("/targets/mock-target-build1", {
          connectionId: "mock-conn-ssh",
          description: "Builds",
          domain: "",
          hostname: "build1.example.org",
          kind: "linux",
          name: "Build host 1",
          realm: "",
        }),
        "mock-target-build1",
      ),
    );
    const t = mockState.world.targets.find((x) => x.id === "mock-target-build1");
    expect(t).toMatchObject({ description: "Builds", name: "Build host 1" });
    expect(t?.sshHostKeys).toHaveLength(1);
  });

  it("hands a refusal back with what was typed", async () => {
    const r = await saveTargetAction(
      post(
        "/targets/mock-target-db1",
        { connectionId: "mock-conn-postgres", hostname: "db1.example.org", name: "Mine now" },
        BOB,
      ),
      "mock-target-db1",
    );
    expect(r).toMatchObject({
      data: { draft: { name: "Mine now" }, refusal: { code: "PERMISSION_DENIED" } },
    });
  });

  it("saves a target with more than one connection, one marked default", async () => {
    const r = await status(
      saveTargetAction(
        post(
          "/targets/new",
          {
            connectionId: ["mock-conn-ssh", "mock-conn-ldaps"],
            defaultConnectionId: "mock-conn-ldaps",
            hostname: "multi.example.org",
            name: "Multi host",
          },
          BOB,
        ),
      ),
    );
    expect(r).toBe(302);
    const saved = mockState.world.targets.at(-1);
    expect(saved?.connectionId).toBe("mock-conn-ldaps");
    expect(saved?.connections).toEqual([
      { connectionId: "mock-conn-ssh", isDefault: false },
      { connectionId: "mock-conn-ldaps", isDefault: true },
    ]);
  });

  it("refuses a target with no connection", async () => {
    const r = await saveTargetAction(
      post("/targets/new", { hostname: "nothing.example.org", name: "Nothing" }, BOB),
    );
    expect(r).toMatchObject({ data: { refusal: { code: "INVALID_ARGUMENT" } } });
  });

  it("refuses two connections on the same protocol", async () => {
    const r = await saveTargetAction(
      post(
        "/targets/new",
        {
          connectionId: ["mock-conn-ssh", "mock-conn-ssh"],
          defaultConnectionId: "mock-conn-ssh",
          hostname: "dup.example.org",
          name: "Dup",
        },
        BOB,
      ),
    );
    expect(r).toMatchObject({ data: { refusal: { code: "INVALID_ARGUMENT" } } });
  });
});
