// @vitest-environment node
import {
  auth,
  GatewayClient,
  GraphQLRequestError,
  TargetsDeleteDocument,
  TargetsListDocument,
  TargetsOpenSshSessionDocument,
  TargetsSaveDocument,
  TargetsTerminalDocument,
  TargetsTerminalFieldsDocument,
} from "@sneakers-web/api-client";

import { MOCK_GATEWAY_URL, MOCK_SESSION_COOKIE, mockState } from "#mock/state";
import { sessionCookie, withMockGateway } from "#mock/testing";

withMockGateway();

const ALICE = "mock-user-alice";
const BOB = "mock-user-bob";
const BUILD_KEY = "mock-secret-build-ssh";

const as = async (userId: string) => {
  const gw = new GatewayClient({
    baseUrl: MOCK_GATEWAY_URL,
    cookieHeader: sessionCookie(userId),
    sessionCookie: MOCK_SESSION_COOKIE,
  });
  await auth.getSession(gw);
  return gw;
};

const refused = async (p: Promise<unknown>) => {
  const error = await p.then(
    () => null,
    (error_: unknown) => error_,
  );
  expect(error).toBeInstanceOf(GraphQLRequestError);
  const r = error as GraphQLRequestError;
  return { code: r.code, reason: r.reason };
};

const world = () => mockState.world;

const bobsTarget = () => {
  world().targets.push({
    connectionId: "mock-conn-ssh",
    hostname: "192.0.2.20",
    id: "mock-target-bob-nas",
    name: "Bob's NAS",
    ownerUserId: BOB,
    sshHostKeys: [],
  });
};

const input = (patch: Record<string, unknown> = {}) => ({
  connectionId: "mock-conn-ssh",
  hostname: "nas.example.org",
  name: "Home NAS",
  ...patch,
});

describe("staff targets in the mock", () => {
  it("lists shared targets and the user's own, with how many secrets use each", async () => {
    bobsTarget();
    const bob = await as(BOB);
    const d = await bob.gql(TargetsListDocument);
    expect(d.targets.map((t) => t.id)).toEqual([
      "mock-target-dc1",
      "mock-target-edge-router",
      "mock-target-db1",
      "mock-target-bob-nas",
    ]);
    expect(d.targets.find((t) => t.id === "mock-target-db1")?.secretCount).toBe(2);
    expect(d.connections.map((c) => c.protocol)).toEqual(["ldap", "ssh", "postgres"]);
  });

  it("lists every target, personal ones included, for a site admin", async () => {
    bobsTarget();
    const gw1 = await as(ALICE);
    const d = await gw1.gql(TargetsListDocument);
    expect(d.targets.map((t) => t.id)).toContain("mock-target-bob-nas");
    expect(d.targets.map((t) => t.id)).toContain("mock-target-build1");
  });

  it("makes a plain user's new target personal, and a site admin's shared", async () => {
    const gw2 = await as(BOB);
    const mine = await gw2.gql(TargetsSaveDocument, { input: input() });
    expect(mine.saveTarget.ownerUserId).toBe(BOB);
    const gw3 = await as(ALICE);
    const shared = await gw3.gql(TargetsSaveDocument, { input: input({ name: "Shared NAS" }) });
    expect(shared.saveTarget.ownerUserId).toBeNull();
    expect(world().targets.map((t) => t.name)).toContain("Home NAS");
  });

  it("lets the owner edit a personal target and keeps its pins and owner", async () => {
    bobsTarget();
    world().targets.at(-1)!.sshHostKeys = ["ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIMockBobKey nas"];
    const gw4 = await as(BOB);
    const d = await gw4.gql(TargetsSaveDocument, {
      input: input({ id: "mock-target-bob-nas", name: "NAS renamed" }),
    });
    expect(d.saveTarget).toMatchObject({ name: "NAS renamed", ownerUserId: BOB });
    expect(d.saveTarget.sshHostKeys).toHaveLength(1);
  });

  it("refuses an edit of someone else's target or a shared one, unless a site admin", async () => {
    bobsTarget();
    const dave = await as("mock-user-dave");
    expect(
      await refused(dave.gql(TargetsSaveDocument, { input: input({ id: "mock-target-bob-nas" }) })),
    ).toEqual({ code: "PERMISSION_DENIED", reason: undefined });
    expect(
      await refused(dave.gql(TargetsSaveDocument, { input: input({ id: "mock-target-db1" }) })),
    ).toEqual({ code: "PERMISSION_DENIED", reason: undefined });
    const gw5 = await as(ALICE);
    const admin = await gw5.gql(TargetsSaveDocument, {
      input: input({ id: "mock-target-bob-nas", name: "Fixed" }),
    });
    expect(admin.saveTarget).toMatchObject({ name: "Fixed", ownerUserId: BOB });
  });

  it("refuses a target without a name or with an unknown connection", async () => {
    const bob = await as(BOB);
    expect(await refused(bob.gql(TargetsSaveDocument, { input: input({ name: " " }) }))).toEqual({
      code: "INVALID_ARGUMENT",
      reason: undefined,
    });
    expect(
      await refused(
        bob.gql(TargetsSaveDocument, { input: input({ connectionId: "mock-conn-nope" }) }),
      ),
    ).toEqual({ code: "NOT_FOUND", reason: undefined });
  });

  it("lets only a site admin change host-key pins", async () => {
    const gw8 = await as(BOB);
    expect(
      await refused(
        gw8.gql(TargetsSaveDocument, {
          input: input({ sshHostKeys: ["ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIMock x"] }),
        }),
      ),
    ).toEqual({ code: "PERMISSION_DENIED", reason: undefined });
  });

  it("deletes an unused personal target, answers false for one in use", async () => {
    bobsTarget();
    const bob = await as(BOB);
    const { deleteTarget: removed } = await bob.gql(TargetsDeleteDocument, {
      id: "mock-target-bob-nas",
    });
    expect(removed).toBe(true);
    expect(world().targets.some((t) => t.id === "mock-target-bob-nas")).toBe(false);
    const alice = await as(ALICE);
    const { deleteTarget: inUse } = await alice.gql(TargetsDeleteDocument, {
      id: "mock-target-db1",
    });
    expect(inUse).toBe(false);
    expect(
      await refused(bob.gql(TargetsDeleteDocument, { id: "mock-target-edge-router" })),
    ).toEqual({ code: "PERMISSION_DENIED", reason: undefined });
  });
});

describe("the SSH terminal in the mock", () => {
  it("gives the terminal the secret, its target and the username, never the key", async () => {
    const gw = await as(ALICE);
    const d = await gw.gql(TargetsTerminalDocument, { id: BUILD_KEY });
    expect(d.secret).toMatchObject({ canRead: true, targetId: "mock-target-build1" });
    const f = await gw.gql(TargetsTerminalFieldsDocument, { id: BUILD_KEY });
    expect(Object.fromEntries(f.secretFields.map((x) => [x.key, x.value]))).toEqual({
      keyFormat: "OpenSSH",
      publicKey: "ssh-ed25519 mock-public-key-build alice@example.org",
      username: "deploy",
    });
  });

  it("hides a secret in someone else's personal folder", async () => {
    const gw6 = await as(BOB);
    const d = await gw6.gql(TargetsTerminalDocument, { id: "mock-secret-alice-wifi" });
    expect(d.secret).toBeNull();
  });

  it("opens a single-use session ticket for a readable SSH key on an SSH target", async () => {
    const gw7 = await as(ALICE);
    const d = await gw7.gql(TargetsOpenSshSessionDocument, { secretId: BUILD_KEY });
    expect(d.openSshSession.ticket).toMatch(/^mock-/);
    expect(d.openSshSession.sessionId).toMatch(/^mock-/);
    expect(d.openSshSession.expiresInSeconds).toBe(30);
  });

  it("refuses without read access, with NO_ACCESS", async () => {
    // Dave isn't in the Platform engineers group and holds no lease, so nothing lets him read it.
    const gw9 = await as("mock-user-dave");
    expect(await refused(gw9.gql(TargetsOpenSshSessionDocument, { secretId: BUILD_KEY }))).toEqual({
      code: "PERMISSION_DENIED",
      reason: "NO_ACCESS",
    });
  });

  it("refuses a secret that isn't an SSH key, or whose target isn't reached over SSH", async () => {
    const alice = await as(ALICE);
    expect(
      await refused(
        alice.gql(TargetsOpenSshSessionDocument, { secretId: "mock-secret-edge-router" }),
      ),
    ).toEqual({ code: "FAILED_PRECONDITION", reason: undefined });
    world().secrets.find((s) => s.id === BUILD_KEY)!.targetId = "mock-target-db1";
    expect(
      await refused(alice.gql(TargetsOpenSshSessionDocument, { secretId: BUILD_KEY })),
    ).toEqual({ code: "FAILED_PRECONDITION", reason: undefined });
  });
});
