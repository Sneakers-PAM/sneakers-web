// @vitest-environment node
import { ApiError, auth, GatewayClient, stepUp } from "@sneakers-web/api-client";

import { factorsOf, type MockFactor } from "#mock/fixtures/staff/settings";
import { userById } from "#mock/fixtures/users";
import { MOCK_GATEWAY_URL, MOCK_SESSION_COOKIE, mockState, resetMockState } from "#mock/state";
import { sessionCookie, withMockGateway } from "#mock/testing";

withMockGateway();

const ALICE = "mock-user-alice";
const BOB = "mock-user-bob";
const DAVE = "mock-user-dave";

const as = async (userId: string) => {
  const gw = new GatewayClient({
    baseUrl: MOCK_GATEWAY_URL,
    cookieHeader: sessionCookie(userId),
    sessionCookie: MOCK_SESSION_COOKIE,
  });
  await auth.getSession(gw);
  return gw;
};

const fresh = async (userId: string) => {
  const gw = await as(userId);
  expect(await stepUp(gw, { code: "123456", kind: "totp" })).toBe("ok");
  return gw;
};

const failure = async (p: Promise<unknown>) => {
  const error = await p.then(
    () => null,
    (error_: unknown) => error_,
  );
  expect(error).toBeInstanceOf(ApiError);
  const refused = error as ApiError;
  return { code: refused.code, status: refused.status };
};

type Listed = { factors: MockFactor[] };

const list = (gw: GatewayClient) => gw.request<Listed>("/auth/mfa/factors", { csrf: true });
const remove = (gw: GatewayClient) =>
  gw.request<{ ok: boolean; signedOut?: boolean }>("/auth/mfa/remove", { body: {}, csrf: true });

describe("GET /auth/mfa/factors", () => {
  it("lists the signed-in user's own factors", async () => {
    const { factors } = await list(await as(ALICE));
    expect(factors.map((f) => [f.kind, f.label])).toEqual([
      ["totp", "Authenticator app"],
      ["email", "Email"],
    ]);
    expect(factors[0]).toMatchObject({ id: "totp", lastUsedAt: null });
    expect(factors[0]?.createdAt).toBeTruthy();
    expect(factors[1]).toEqual({
      createdAt: null,
      id: "email",
      kind: "email",
      label: "Email",
      lastUsedAt: null,
    });
  });

  it("lists only the implicit email factor for someone without TOTP or a passkey", async () => {
    const { factors } = await list(await as(BOB));
    expect(factors.map((f) => f.kind)).toEqual(["email"]);
  });

  it("needs the session and its CSRF header", async () => {
    const anon = new GatewayClient({
      baseUrl: MOCK_GATEWAY_URL,
      cookieHeader: null,
      sessionCookie: MOCK_SESSION_COOKIE,
    });
    expect(await failure(anon.request("/auth/mfa/factors"))).toEqual({
      code: "no_session",
      status: 401,
    });
    const noCsrf = new GatewayClient({
      baseUrl: MOCK_GATEWAY_URL,
      cookieHeader: sessionCookie(ALICE),
      sessionCookie: MOCK_SESSION_COOKIE,
    });
    expect(await failure(noCsrf.request("/auth/mfa/factors"))).toEqual({
      code: "csrf",
      status: 403,
    });
  });
});

describe("POST /auth/mfa/remove", () => {
  it("asks for a fresh second factor first", async () => {
    expect(await failure(remove(await as(ALICE)))).toEqual({
      code: "step_up_required",
      status: 403,
    });
    expect(userById(ALICE)?.factors).toContain("totp");
    expect(mockState.sessions.size).toBe(1);
  });

  it("removes the authenticator and ends the session, so the next sign-in offers email only", async () => {
    const gw = await fresh(ALICE);
    expect(await remove(gw)).toEqual({ ok: true, signedOut: true });
    expect(gw.hasSessionCookie).toBe(false);
    expect(mockState.sessions.size).toBe(0);
    const next = new GatewayClient({
      baseUrl: MOCK_GATEWAY_URL,
      cookieHeader: null,
      sessionCookie: MOCK_SESSION_COOKIE,
    });
    const login = await auth.login(next, "alice", "any password");
    expect(login).toMatchObject({ factors: ["email"], kind: "challenge" });
  });

  it("refuses to remove the last factor of someone who must use MFA", async () => {
    userById(DAVE)!.factors = ["totp", "email"];
    expect(await failure(remove(await fresh(DAVE)))).toEqual({
      code: "last_factor",
      status: 409,
    });
    expect(userById(DAVE)?.factors).toEqual(["totp", "email"]);
  });

  it("puts every factor back on a mock reset", async () => {
    await remove(await fresh(ALICE));
    expect(userById(ALICE)?.factors).toEqual(["email"]);
    resetMockState();
    expect(userById(ALICE)?.factors).toEqual(["totp", "email"]);
  });
});

describe("adding a factor", () => {
  it("lets someone with no factor add an authenticator without a step-up", async () => {
    const gw = await as(BOB);
    const { secret } = await auth.beginTotpEnrollment(gw);
    expect(secret).not.toBe("");
    expect(await auth.confirmTotpEnrollment(gw, "123456")).toBe(true);
    expect(factorsOf(BOB).map((f) => f.kind)).toEqual(["totp", "email"]);
    const { factors } = await list(gw);
    expect(factors[0]).toMatchObject({ kind: "totp", lastUsedAt: null });
  });

  it("lets someone with only email codes add an authenticator without a step-up", async () => {
    userById(BOB)!.factors = ["email"];
    const { secret } = await auth.beginTotpEnrollment(await as(BOB));
    expect(secret).not.toBe("");
  });

  it("asks for a step-up before someone with a factor starts another", async () => {
    const gw = await as(ALICE);
    expect(await failure(auth.beginTotpEnrollment(gw))).toEqual({
      code: "step_up_required",
      status: 403,
    });
    expect(await failure(auth.beginPasskeyEnrollment(gw))).toEqual({
      code: "step_up_required",
      status: 403,
    });
    const stepped = await fresh(ALICE);
    expect(await failure(auth.beginPasskeyEnrollment(stepped))).toEqual({
      code: "no_passkey",
      status: 400,
    });
  });

  it("records nothing when the code is wrong", async () => {
    const gw = await as(BOB);
    await auth.beginTotpEnrollment(gw);
    expect(await auth.confirmTotpEnrollment(gw, "000000")).toBe(false);
    expect(factorsOf(BOB).map((f) => f.kind)).toEqual(["email"]);
  });
});
