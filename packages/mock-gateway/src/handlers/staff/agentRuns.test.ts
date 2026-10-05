// @vitest-environment node
import {
  AgentsDecideUsesDocument,
  AgentsUseRunDocument,
  auth,
  GatewayClient,
  GraphQLRequestError,
  stepUp,
} from "@sneakers-web/api-client";

import type { MockSecretUse } from "#mock/fixtures/world";

import { MOCK_MFA_MAX_AGE_MS } from "#mock/handlers/stepUp";
import { MOCK_GATEWAY_URL, MOCK_SESSION_COOKIE, mockState } from "#mock/state";
import { sessionCookie, withMockGateway } from "#mock/testing";

withMockGateway();

const ALICE = "mock-user-alice";
const BOB = "mock-user-bob";
const RUN = "run_mock_build1";
const TOTP = { code: "123456", kind: "totp" };
const nowUnix = () => Math.floor(Date.now() / 1000);

const world = () => mockState.world;
const secretUse = (id: string) => world().secretUses.find((u) => u.id === id)!;

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

/** Add a pending use to the fixture run, as another prepareSecretUse in it would. */
const raise = (id: string, over: Partial<MockSecretUse> = {}) => {
  world().secretUses.push({
    ...secretUse("mock-use-1"),
    argv: [],
    fieldKey: "token",
    id,
    reveal: true,
    secretId: "mock-secret-status-api",
    secretName: "Status page API",
    ...over,
  });
};

describe("a run's pending uses", () => {
  it("lists the owner's pending uses in the run, named by the token that asked", async () => {
    raise("mock-use-run-2");
    raise("mock-use-other-run", { runId: "run_mock_other" });
    const { secretUseRun } = await as(ALICE).then((gw) =>
      gw.gql(AgentsUseRunDocument, { runId: RUN }),
    );
    expect(secretUseRun.runId).toBe(RUN);
    expect(secretUseRun.uses.map((u) => u.id)).toEqual(["mock-use-1", "mock-use-run-2"]);
    expect(secretUseRun.uses[0]).toMatchObject({
      purpose: secretUse("mock-use-1").purpose,
      requester: "build1 agent",
      runId: RUN,
    });
  });

  it("never lists another owner's uses, or expired ones", async () => {
    raise("mock-use-bob", { ownerUserId: BOB, tokenId: "mock-token-3" });
    raise("mock-use-gone", { expiresAtUnix: nowUnix() - 1 });
    const bob = await as(BOB).then((gw) => gw.gql(AgentsUseRunDocument, { runId: RUN }));
    expect(bob.secretUseRun.uses.map((u) => u.id)).toEqual(["mock-use-bob"]);
    const alice = await as(ALICE).then((gw) => gw.gql(AgentsUseRunDocument, { runId: RUN }));
    expect(alice.secretUseRun.uses.map((u) => u.id)).toEqual(["mock-use-1"]);
  });

  it("falls back to the client label when the token is gone", async () => {
    raise("mock-use-untokened", { clientLabel: "Sneakers MCP", tokenId: undefined });
    const { secretUseRun } = await as(ALICE).then((gw) =>
      gw.gql(AgentsUseRunDocument, { runId: RUN }),
    );
    expect(secretUseRun.uses.find((u) => u.id === "mock-use-untokened")?.requester).toBe(
      "Sneakers MCP",
    );
  });

  it("says how long the session's factor covers an approval, 0 when it doesn't", async () => {
    const gw = await as(ALICE);
    const before = await gw.gql(AgentsUseRunDocument, { runId: RUN });
    expect(before.secretUseRun.mfaFreshUntilUnix).toBe(0);
    expect(await stepUp(gw, { code: "123456", kind: "totp" })).toBe("ok");
    const after = await gw.gql(AgentsUseRunDocument, { runId: RUN });
    const until = after.secretUseRun.mfaFreshUntilUnix;
    expect(until).toBeGreaterThan(nowUnix());
    expect(until).toBeLessThanOrEqual(nowUnix() + MOCK_MFA_MAX_AGE_MS / 1000);
  });
});

describe("deciding a batch", () => {
  it("approves inside the session's factor window, one outcome per distinct id in order", async () => {
    raise("mock-use-run-2");
    const gw = await as(ALICE);
    await stepUp(gw, { code: "123456", kind: "totp" });
    const { decideSecretUses } = await gw.gql(AgentsDecideUsesDocument, {
      decision: "APPROVE",
      ids: ["mock-use-run-2", "mock-use-1", "mock-use-run-2"],
    });
    expect(decideSecretUses.outcomes.map((o) => [o.id, o.decided, o.reason])).toEqual([
      ["mock-use-run-2", true, null],
      ["mock-use-1", true, null],
    ]);
    expect(decideSecretUses.outcomes[1]?.use).toMatchObject({ state: "APPROVED" });
    expect(secretUse("mock-use-1").state).toBe("approved");
    expect(secretUse("mock-use-1").expiresAtUnix).toBeLessThanOrEqual(nowUnix() + 60);
  });

  it("approves with a factor given once instead of a session window", async () => {
    const gw = await as(ALICE);
    const { decideSecretUses } = await gw.gql(AgentsDecideUsesDocument, {
      decision: "APPROVE",
      factor: TOTP,
      ids: ["mock-use-1"],
    });
    expect(decideSecretUses.outcomes[0]?.decided).toBe(true);
  });

  it("refuses an approval outside the window, deciding nothing, and denies without a factor", async () => {
    raise("mock-use-run-2");
    const gw = await as(ALICE);
    expect(
      await refused(gw.gql(AgentsDecideUsesDocument, { decision: "APPROVE", ids: ["mock-use-1"] })),
    ).toEqual({ code: "FAILED_PRECONDITION", reason: "STEP_UP_REQUIRED" });
    expect(
      await refused(
        gw.gql(AgentsDecideUsesDocument, {
          decision: "APPROVE",
          factor: { code: "000000", kind: "totp" },
          ids: ["mock-use-1"],
        }),
      ),
    ).toEqual({ code: "UNAUTHENTICATED", reason: "FACTOR_NOT_ACCEPTED" });
    expect(secretUse("mock-use-1").state).toBe("pending");
    const { decideSecretUses } = await gw.gql(AgentsDecideUsesDocument, {
      decision: "DENY",
      ids: ["mock-use-1", "mock-use-run-2"],
    });
    expect(decideSecretUses.outcomes.every((o) => o.decided)).toBe(true);
    expect(secretUse("mock-use-1").state).toBe("denied");
    expect(secretUse("mock-use-run-2").state).toBe("denied");
  });

  it("refuses a window that has closed", async () => {
    const gw = await as(ALICE);
    await stepUp(gw, { code: "123456", kind: "totp" });
    for (const s of mockState.sessions.values()) {
      if (s.mfaVerifiedAt) s.mfaVerifiedAt -= MOCK_MFA_MAX_AGE_MS + 1000;
    }
    const r = await refused(
      gw.gql(AgentsDecideUsesDocument, { decision: "APPROVE", ids: ["mock-use-1"] }),
    );
    expect(r.reason).toBe("STEP_UP_REQUIRED");
  });

  it("refuses no ids or more than 20 distinct ones before the factor", async () => {
    const gw = await as(ALICE);
    const many = Array.from({ length: 21 }, (_, index) => `mock-use-batch-${index}`);
    for (const ids of [[], many]) {
      expect(await refused(gw.gql(AgentsDecideUsesDocument, { decision: "APPROVE", ids }))).toEqual(
        { code: "INVALID_ARGUMENT", reason: "BATCH_SIZE_INVALID" },
      );
    }
    const twenty = Array.from({ length: 20 }, () => "mock-use-1");
    const { decideSecretUses } = await gw.gql(AgentsDecideUsesDocument, {
      decision: "DENY",
      ids: [...twenty, ...many.slice(0, 19)],
    });
    expect(decideSecretUses.outcomes).toHaveLength(20);
  });

  it("decides the rest of a mixed batch, with a reason for each refused item", async () => {
    raise("mock-use-expired", { expiresAtUnix: nowUnix() - 1 });
    raise("mock-use-bob", { ownerUserId: BOB, tokenId: "mock-token-3" });
    raise("mock-use-denied", { state: "denied" });
    const gw = await as(ALICE);
    await stepUp(gw, { code: "123456", kind: "totp" });
    const { decideSecretUses } = await gw.gql(AgentsDecideUsesDocument, {
      decision: "APPROVE",
      ids: ["mock-use-expired", "mock-use-bob", "mock-use-denied", "mock-use-nope", "mock-use-1"],
    });
    expect(decideSecretUses.outcomes.map((o) => [o.id, o.decided, o.reason])).toEqual([
      ["mock-use-expired", false, "EXPIRED"],
      ["mock-use-bob", false, "NOT_PERMITTED"],
      ["mock-use-denied", false, "ALREADY_DECIDED"],
      ["mock-use-nope", false, "NOT_FOUND"],
      ["mock-use-1", true, null],
    ]);
    expect(decideSecretUses.outcomes[0]?.use).toBeNull();
    expect(secretUse("mock-use-bob").state).toBe("pending");
  });
});
