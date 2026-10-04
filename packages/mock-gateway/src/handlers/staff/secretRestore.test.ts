// @vitest-environment node
import {
  auth,
  GatewayClient,
  GraphQLRequestError,
  SecretRestoreVersionDocument,
  SecretRevealVersionDocument,
  SecretRotateDocument,
  SecretVersionsDocument,
  stepUp,
} from "@sneakers-web/api-client";

import { userById } from "#mock/fixtures/users";
import { MOCK_GATEWAY_URL, MOCK_SESSION_COOKIE, mockState } from "#mock/state";
import { sessionCookie, withMockGateway } from "#mock/testing";

withMockGateway();

const ALICE = "mock-user-alice";
const BOB = "mock-user-bob";
const DB = "mock-secret-db-admin";

const as = async (userId: string) => {
  const gw = new GatewayClient({
    baseUrl: MOCK_GATEWAY_URL,
    cookieHeader: sessionCookie(userId),
    sessionCookie: MOCK_SESSION_COOKIE,
  });
  await auth.getSession(gw);
  return gw;
};

/** A recovery-role holder who has just passed a step-up. */
const recovering = async (userId = ALICE) => {
  userById(userId)?.roles.push("recovery");
  const gw = await as(userId);
  await stepUp(gw, { code: "123456", kind: "totp" });
  return gw;
};

const refused = async (p: Promise<unknown>) => {
  const error = await p.then(
    () => null,
    (error_: unknown) => error_,
  );
  expect(error).toBeInstanceOf(GraphQLRequestError);
  const r = error as GraphQLRequestError;
  return { code: r.code, metadata: r.metadata, reason: r.reason };
};

const secret = (id: string) => mockState.world.secrets.find((s) => s.id === id)!;

const holdLease = (userId: string, secretId = DB) =>
  mockState.world.leases.push({
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    id: `mock-lease-restore-${userId}`,
    issuedAt: new Date().toISOString(),
    returned: false,
    secretId,
    userId,
  });

describe("restoring a secret version in the mock gateway", () => {
  it("needs the recovery role, then a fresh second factor", async () => {
    const plain = await as(ALICE);
    expect(
      await refused(plain.gql(SecretRestoreVersionDocument, { secretId: DB, versionNo: 2 })),
    ).toMatchObject({ code: "PERMISSION_DENIED", reason: "RECOVERY_ROLE_REQUIRED" });

    userById(ALICE)?.roles.push("recovery");
    const stale = await as(ALICE);
    expect(
      await refused(stale.gql(SecretRestoreVersionDocument, { secretId: DB, versionNo: 2 })),
    ).toMatchObject({ code: "FAILED_PRECONDITION", reason: "STEP_UP_REQUIRED" });
    expect(secret(DB).versions).toHaveLength(3);
  });

  it("adds a new active version with the old version's values", async () => {
    const gw = await recovering();
    const old = await gw.gql(SecretRevealVersionDocument, {
      fieldKey: "password",
      secretId: DB,
      versionNo: 2,
    });
    const before = secret(DB).fields.password;

    const r = await gw.gql(SecretRestoreVersionDocument, { secretId: DB, versionNo: 2 });
    expect(r.restoreSecretVersion.id).toBe(DB);

    const { secretVersions } = await gw.gql(SecretVersionsDocument, { secretId: DB });
    expect(secretVersions.map((v) => [v.versionNo, v.active])).toEqual([
      [4, true],
      [3, false],
      [2, false],
      [1, false],
    ]);
    expect(secretVersions[0]?.createdBy).toBe(ALICE);
    expect(secretVersions[0]?.changedFieldKeys).toContain("password");
    expect(secret(DB).fields.password).toBe(old.revealSecretVersionField);

    // The version it replaced keeps its own values, so it can be restored in turn.
    const replaced = await gw.gql(SecretRevealVersionDocument, {
      fieldKey: "password",
      secretId: DB,
      versionNo: 3,
    });
    expect(replaced.revealSecretVersionField).toBe(before);
  });

  it("keeps a rotated-away value, so an earlier version reveals what it really held", async () => {
    const gw = await recovering();
    const before = secret(DB).fields.password;
    await gw.gql(SecretRotateDocument, { secretId: DB });
    const v3 = await gw.gql(SecretRevealVersionDocument, {
      fieldKey: "password",
      secretId: DB,
      versionNo: 3,
    });
    expect(v3.revealSecretVersionField).toBe(before);
  });

  it("is refused while anyone holds a lease, naming the holder", async () => {
    holdLease(BOB);
    const gw = await recovering();
    expect(
      await refused(gw.gql(SecretRestoreVersionDocument, { secretId: DB, versionNo: 2 })),
    ).toEqual({
      code: "FAILED_PRECONDITION",
      metadata: { holder_user_id: BOB },
      reason: "CHECKOUT_LEASE_HELD",
    });
    expect(secret(DB).versions).toHaveLength(3);
  });

  it("is refused while the secret is rotating", async () => {
    secret(DB).lastRotationResult = "rotating";
    const gw = await recovering();
    expect(
      await refused(gw.gql(SecretRestoreVersionDocument, { secretId: DB, versionNo: 2 })),
    ).toMatchObject({ code: "FAILED_PRECONDITION", reason: "ROTATION_IN_PROGRESS" });
    expect(secret(DB).versions).toHaveLength(3);
  });

  it("is refused for a retired secret, even to the recovery role with a fresh MFA", async () => {
    const legacy = secret("mock-secret-legacy-portal");
    // A second version, so version 1 is one that could otherwise be restored.
    for (const v of legacy.versions) v.active = false;
    legacy.versions.unshift({ ...legacy.versions[0]!, active: true, versionNo: 2 });
    const gw = await recovering();
    expect(
      await refused(gw.gql(SecretRestoreVersionDocument, { secretId: legacy.id, versionNo: 1 })),
    ).toMatchObject({ code: "FAILED_PRECONDITION", reason: "RETIRED" });
    expect(legacy.versions).toHaveLength(2);
    expect(legacy.retired).toBe(true);
  });

  it("refuses the current version, a missing one, a locked secret and one the user can't see", async () => {
    const gw = await recovering();
    expect(
      await refused(gw.gql(SecretRestoreVersionDocument, { secretId: DB, versionNo: 3 })),
    ).toMatchObject({ code: "FAILED_PRECONDITION" });
    expect(
      await refused(gw.gql(SecretRestoreVersionDocument, { secretId: DB, versionNo: 9 })),
    ).toMatchObject({ code: "NOT_FOUND" });
    expect(
      await refused(
        gw.gql(SecretRestoreVersionDocument, { secretId: "mock-secret-helpdesk", versionNo: 1 }),
      ),
    ).toMatchObject({ code: "PERMISSION_DENIED", reason: "NO_ACCESS" });

    const bob = await recovering(BOB);
    expect(
      await refused(
        bob.gql(SecretRestoreVersionDocument, { secretId: "mock-secret-alice-wifi", versionNo: 1 }),
      ),
    ).toMatchObject({ code: "NOT_FOUND" });
  });
});
