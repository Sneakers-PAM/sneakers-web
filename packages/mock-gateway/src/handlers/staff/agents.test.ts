// @vitest-environment node
import {
  AgentsCreateGrantDocument,
  AgentsDecideUseDocument,
  AgentsGrantsDocument,
  AgentsPendingUsesDocument,
  AgentsRevokeGrantDocument,
  AgentsRevokeTokenDocument,
  AgentsTokensDocument,
  ApiError,
  auth,
  GatewayClient,
  GraphQLRequestError,
  ShellCountsDocument,
} from "@sneakers-web/api-client";

import { agentsState, MOCK_CONSENT_EXPIRED_ID, MOCK_CONSENT_ID } from "#mock/fixtures/staff/agents";
import { MOCK_GATEWAY_URL, MOCK_SESSION_COOKIE, mockState } from "#mock/state";
import { sessionCookie, withMockGateway } from "#mock/testing";

withMockGateway();

const ALICE = "mock-user-alice";
const BOB = "mock-user-bob";
const TOTP = { code: "123456", kind: "totp" };
const nowUnix = () => Math.floor(Date.now() / 1000);

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
  const refusal = error as GraphQLRequestError;
  return { code: refusal.code, message: refusal.message, reason: refusal.reason };
};

/** Why a call was refused: its code, or undefined for the gateway's own uncoded checks. */
const codeOf = async (p: Promise<unknown>) => {
  const r = await refused(p);
  return r.code;
};

const consent = (gw: GatewayClient, id: string, body?: unknown) =>
  gw.request<Record<string, string>>(`/oauth2/consent/${id}`, { body, csrf: true });

const world = () => mockState.world;
const use = (id: string) => world().secretUses.find((u) => u.id === id)!;

const grantInput = (over: Record<string, unknown> = {}) => ({
  expiresAtUnix: nowUnix() + 4 * 3600,
  programs: [{ argPattern: "-h db1.example.org *", program: "psql" }],
  secretIds: ["mock-secret-db-admin"],
  tokenId: "mock-token-1",
  ...over,
});

describe("personal tokens", () => {
  it("lists only the signed-in owner's tokens", async () => {
    const alice = await as(ALICE).then((gw) => gw.gql(AgentsTokensDocument));
    expect(alice.myTokens.map((t) => t.id)).toEqual(["mock-token-1", "mock-token-2"]);
    const bob = await as(BOB).then((gw) => gw.gql(AgentsTokensDocument));
    expect(bob.myTokens.map((t) => t.id)).toEqual(["mock-token-3"]);
  });

  it("revokes your own token, and never someone else's", async () => {
    const gw = await as(ALICE);
    const { revokeMyToken } = await gw.gql(AgentsRevokeTokenDocument, { id: "mock-token-1" });
    expect(revokeMyToken.revokedAtUnix).toBeGreaterThan(0);
    expect(world().tokens.find((t) => t.id === "mock-token-1")?.revokedAtUnix).toBeGreaterThan(0);
    expect(await codeOf(gw.gql(AgentsRevokeTokenDocument, { id: "mock-token-3" }))).toBe(
      "NOT_FOUND",
    );
    expect(world().tokens.find((t) => t.id === "mock-token-3")?.revokedAtUnix).toBe(0);
  });
});

describe("pending uses", () => {
  it("lists the owner's live pending uses, as the gateway names the state", async () => {
    const { pendingSecretUses } = await as(ALICE).then((gw) => gw.gql(AgentsPendingUsesDocument));
    expect(pendingSecretUses.map((u) => [u.id, u.state])).toEqual([["mock-use-1", "PENDING"]]);
    const bob = await as(BOB).then((gw) => gw.gql(AgentsPendingUsesDocument));
    expect(bob.pendingSecretUses).toEqual([]);
  });

  it("expires a pending use at its time, and the header count follows", async () => {
    use("mock-use-1").expiresAtUnix = nowUnix() - 1;
    const gw = await as(ALICE);
    const after = await gw.gql(AgentsPendingUsesDocument);
    expect(after.pendingSecretUses).toEqual([]);
    expect(use("mock-use-1").state).toBe("expired");
    const counts = await gw.gql(ShellCountsDocument, { userId: ALICE });
    expect(counts.pendingSecretUses).toEqual([]);
  });

  it("leaves an expired pending use out of the header count, even before anything sweeps it", async () => {
    use("mock-use-1").expiresAtUnix = nowUnix() - 1;
    const gw = await as(ALICE);
    const counts = await gw.gql(ShellCountsDocument, { userId: ALICE });
    expect(counts.pendingSecretUses).toEqual([]);
  });

  it("approves with a factor, for a minute's redemption", async () => {
    const gw = await as(ALICE);
    const { decideSecretUse } = await gw.gql(AgentsDecideUseDocument, {
      approve: true,
      factor: TOTP,
      id: "mock-use-1",
    });
    expect(decideSecretUse.state).toBe("APPROVED");
    expect(use("mock-use-1").state).toBe("approved");
    expect(use("mock-use-1").expiresAtUnix).toBeLessThanOrEqual(nowUnix() + 60);
    const counts = await gw.gql(ShellCountsDocument, { userId: ALICE });
    expect(counts.pendingSecretUses).toEqual([]);
  });

  it("refuses an approval without a factor or with a wrong one, and denies without one", async () => {
    const gw = await as(ALICE);
    const none = await refused(
      gw.gql(AgentsDecideUseDocument, { approve: true, id: "mock-use-1" }),
    );
    expect(none.code).toBeUndefined();
    const wrong = await refused(
      gw.gql(AgentsDecideUseDocument, {
        approve: true,
        factor: { code: "000000", kind: "totp" },
        id: "mock-use-1",
      }),
    );
    expect(wrong.code).toBeUndefined();
    expect(use("mock-use-1").state).toBe("pending");
    const { decideSecretUse } = await gw.gql(AgentsDecideUseDocument, {
      approve: false,
      id: "mock-use-1",
    });
    expect(decideSecretUse.state).toBe("DENIED");
  });

  it("refuses a decision on someone else's use, or on one that isn't pending", async () => {
    const bob = await as(BOB);
    expect(
      await codeOf(bob.gql(AgentsDecideUseDocument, { approve: false, id: "mock-use-1" })),
    ).toBe("PERMISSION_DENIED");
    const gw = await as(ALICE);
    expect(
      await codeOf(gw.gql(AgentsDecideUseDocument, { approve: false, id: "mock-use-2" })),
    ).toBe("FAILED_PRECONDITION");
    expect(
      await codeOf(gw.gql(AgentsDecideUseDocument, { approve: false, id: "mock-use-x" })),
    ).toBe("NOT_FOUND");
  });
});

describe("use grants", () => {
  it("answers the owner's grants and tokens, and only what they can read to pick from", async () => {
    const d = await as(ALICE).then((gw) => gw.gql(AgentsGrantsDocument));
    expect(d.useGrants.map((g) => [g.id, g.programs])).toEqual([
      ["mock-grant-1", [{ argPattern: "-h db1.example.org", program: "psql" }]],
    ]);
    expect(d.myTokens.map((t) => t.id)).toEqual(["mock-token-1", "mock-token-2"]);
    const readable = new Set(d.secretsByStatus.map((s) => s.id));
    expect(readable.has("mock-secret-db-admin")).toBe(true);
    for (const s of world().secrets.filter((x) => !x.canRead || x.retired)) {
      expect(readable.has(s.id)).toBe(false);
    }
    const bob = await as(BOB).then((gw) => gw.gql(AgentsGrantsDocument));
    expect(bob.useGrants).toEqual([]);
  });

  it("creates a grant with a factor for one of your tokens", async () => {
    const gw = await as(ALICE);
    const { createUseGrant } = await gw.gql(AgentsCreateGrantDocument, {
      factor: TOTP,
      input: grantInput({ maxUses: 5 }),
    });
    expect(createUseGrant).toMatchObject({
      maxUses: 5,
      programs: [{ argPattern: "-h db1.example.org *", program: "psql" }],
      tokenId: "mock-token-1",
      uses: 0,
    });
    expect(world().useGrants.map((g) => g.id)).toContain(createUseGrant.id);
  });

  it("refuses a grant with a wrong factor, for someone else's token, or out of bounds", async () => {
    const gw = await as(ALICE);
    await refused(
      gw.gql(AgentsCreateGrantDocument, {
        factor: { code: "000000", kind: "totp" },
        input: grantInput(),
      }),
    );
    await refused(
      gw.gql(AgentsCreateGrantDocument, {
        factor: TOTP,
        input: grantInput({ tokenId: "mock-token-3" }),
      }),
    );
    const long = await refused(
      gw.gql(AgentsCreateGrantDocument, {
        factor: TOTP,
        input: grantInput({ expiresAtUnix: nowUnix() + 25 * 3600 }),
      }),
    );
    expect(long.code).toBe("INVALID_ARGUMENT");
    const both = await refused(
      gw.gql(AgentsCreateGrantDocument, {
        factor: TOTP,
        input: grantInput({ programs: [], secretIds: [] }),
      }),
    );
    expect(both.code).toBe("INVALID_ARGUMENT");
    expect(world().useGrants).toHaveLength(1);
  });

  it("revokes your own grant, and never someone else's", async () => {
    const gw = await as(ALICE);
    const { revokeUseGrant } = await gw.gql(AgentsRevokeGrantDocument, { id: "mock-grant-1" });
    expect(revokeUseGrant.revokedAtUnix).toBeGreaterThan(0);
    const bob = await as(BOB);
    world().useGrants[0]!.revokedAtUnix = 0;
    expect(await codeOf(bob.gql(AgentsRevokeGrantDocument, { id: "mock-grant-1" }))).toBe(
      "NOT_FOUND",
    );
    expect(world().useGrants[0]?.revokedAtUnix).toBe(0);
  });
});

describe("agent consent", () => {
  it("names the app and where it returns to", async () => {
    expect(await consent(await as(ALICE), MOCK_CONSENT_ID)).toEqual({
      clientName: "MCP client",
      redirectHost: "127.0.0.1:53682",
    });
  });

  it("starts a fresh request for a new mock id, as an agent's sign-in would, and only once", async () => {
    const gw = await as(ALICE);
    const id = "mock-consent-new-e2e-1";
    expect(await consent(gw, id)).toEqual({
      clientName: "MCP client",
      redirectHost: "127.0.0.1:53682",
    });
    const { redirect } = await consent(gw, id, { approve: false, factor: {}, label: "" });
    expect(new URL(redirect!).searchParams.get("error")).toBe("access_denied");
    const again = await consent(gw, id).catch((error_: unknown) => error_);
    expect((again as ApiError).code).toBe("request_expired");
  });

  it("answers an expired or unknown request with request_expired", async () => {
    const gw = await as(ALICE);
    for (const id of [MOCK_CONSENT_EXPIRED_ID, "mock-consent-x"]) {
      const error = await consent(gw, id).catch((error_: unknown) => error_);
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).code).toBe("request_expired");
    }
  });

  it("approves with a factor: a code for the app and a token under My tokens", async () => {
    const gw = await as(ALICE);
    const wrong = await consent(gw, MOCK_CONSENT_ID, {
      approve: true,
      factor: { code: "000000", kind: "totp" },
      label: "laptop agent",
    }).catch((error_: unknown) => error_);
    expect((wrong as ApiError).code).toBe("invalid_code");
    const { redirect } = await consent(gw, MOCK_CONSENT_ID, {
      approve: true,
      factor: TOTP,
      label: "laptop agent",
    });
    const url = new URL(redirect!);
    expect(url.origin).toBe("http://127.0.0.1:53682");
    expect(url.searchParams.get("state")).toBe("mock-state-1");
    expect(url.searchParams.get("code")).toMatch(/^mock-code-/);
    expect(agentsState.consents.has(MOCK_CONSENT_ID)).toBe(false);
    const mine = world().tokens.filter((t) => t.ownerUserId === ALICE);
    expect(mine.at(-1)).toMatchObject({ clientName: "MCP client", label: "laptop agent" });
  });

  it("denies without a factor and sends access_denied back", async () => {
    const { redirect } = await consent(await as(ALICE), MOCK_CONSENT_ID, {
      approve: false,
      factor: {},
      label: "",
    });
    expect(new URL(redirect!).searchParams.get("error")).toBe("access_denied");
    expect(agentsState.consents.has(MOCK_CONSENT_ID)).toBe(false);
  });
});
