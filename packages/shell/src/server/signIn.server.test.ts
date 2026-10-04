// @vitest-environment node
import { MOCK_SESSION_COOKIE } from "@sneakers-web/mock-gateway";
import { appRequest, cookieFrom, form, withMockGateway } from "@sneakers-web/mock-gateway/testing";

import { requireUser } from "#shell/server/session.server";
import { signInAction, signInLoader, type SignInState } from "#shell/server/signIn.server";

withMockGateway();

type DataResult = { data: SignInState; init?: { headers?: HeadersInit } | null };

const act = async (fields: Record<string, string>) => {
  const request = appRequest("/sign-in", { body: form({ next: "/", ...fields }), method: "POST" });
  return (await signInAction({
    context: {},
    params: {},
    request,
  } as never)) as unknown as DataResult;
};

const catchResponse = async (p: Promise<unknown>): Promise<Response> => {
  try {
    await p;
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  }
  throw new Error("expected a redirect");
};

describe("sign-in, through the gateway's routes", () => {
  it("asks Alice for her second factor, refuses a wrong code and signs her in with the right one", async () => {
    const first = await act({ identifier: "alice", intent: "login", password: "any" });
    expect(first.data).toMatchObject({ factors: ["totp", "email"], view: "code" });
    const pendingId = (first.data as Extract<SignInState, { view: "code" }>).pendingId;
    const carry = { factor: "totp", factors: "totp,email", identifier: "alice", pendingId };

    const wrong = await act({ ...carry, code: "000000", intent: "verify" });
    expect(wrong.data).toMatchObject({ view: "code", wrong: true });

    const done = await act({ ...carry, code: "481027", intent: "verify" });
    expect(done.data).toEqual({ name: "Alice", next: "/", view: "done" });
    const cookie = cookieFrom(new Headers(done.init?.headers));
    expect(cookie.startsWith(`${MOCK_SESSION_COOKIE}=`)).toBe(true);

    const { user } = await requireUser(appRequest("/", { cookie }));
    expect(user.email).toBe("alice@example.org");
  });

  it("opens straight away for an account with no factor", async () => {
    const r = await act({ identifier: "bob@example.org", intent: "login", password: "any" });
    expect(r.data).toEqual({ name: "Bob", next: "/", view: "done" });
  });

  it("sends an account that must enrol to the enrolment wall", async () => {
    const response = await catchResponse(
      act({ identifier: "dave", intent: "login", password: "any" }),
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/enroll");
  });

  it("names the problem without saying which part was wrong", async () => {
    const unknown = await act({ identifier: "nobody", intent: "login", password: "x" });
    expect(unknown.data).toMatchObject({ problem: "invalid" });
    const disabled = await act({ identifier: "erin", intent: "login", password: "x" });
    expect(disabled.data).toMatchObject({ problem: "disabled" });
    const empty = await act({ identifier: "", intent: "login", password: "" });
    expect(empty.data).toMatchObject({ problem: "missing" });
  });

  it("starts single sign-on with a redirect", async () => {
    const response = await catchResponse(act({ intent: "sso" }));
    expect(response.headers.get("Location")).toMatch(/sso_pending=/);
  });

  it("picks up the SSO hand-back and its failures", async () => {
    const back = await signInLoader({
      context: {},
      params: {},
      request: appRequest("/sign-in?sso_pending=mock-pending-sso&factors=totp,email"),
    } as never);
    expect(back.state).toMatchObject({ pendingId: "mock-pending-sso", view: "code" });
    const failed = await signInLoader({
      context: {},
      params: {},
      request: appRequest("/sign-in?sso_error=no_user"),
    } as never);
    expect(failed.state).toEqual({ failed: true, view: "sso" });
  });

  it("only follows a next link that stays inside the app", async () => {
    const out = await signInLoader({
      context: {},
      params: {},
      request: appRequest("/sign-in?next=//elsewhere.example.org/"),
    } as never);
    expect(out.next).toBe("/");
  });
});

describe("the dev quick login", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("lists the fixture users only in a mock build", async () => {
    vi.stubEnv("SNEAKERS_MOCK", "true");
    const mock = await signInLoader({
      context: {},
      params: {},
      request: appRequest("/sign-in"),
    } as never);
    expect(mock.quickLoginUsers.map((u) => u.id)).toContain("mock-user-alice");
    vi.stubEnv("SNEAKERS_MOCK", "false");
    const live = await signInLoader({
      context: {},
      params: {},
      request: appRequest("/sign-in"),
    } as never);
    expect(live.quickLoginUsers).toEqual([]);
  });

  it("signs in as the chosen user and goes on, with a session that works", async () => {
    vi.stubEnv("SNEAKERS_MOCK", "true");
    const r = await catchResponse(
      act({ intent: "mock-quick-login", next: "/secrets", userId: "mock-user-bob" }),
    );
    expect(r.status).toBe(302);
    expect(r.headers.get("Location")).toBe("/secrets");
    const cookie = cookieFrom(r.headers);
    const { user } = await requireUser(appRequest("/", { cookie }));
    expect(user.id).toBe("mock-user-bob");
  });

  it("sends a user who must enrol to enrolment", async () => {
    vi.stubEnv("SNEAKERS_MOCK", "true");
    const r = await catchResponse(act({ intent: "mock-quick-login", userId: "mock-user-dave" }));
    expect(r.headers.get("Location")).toBe("/enroll");
  });

  it("signs no one in outside a mock build", async () => {
    vi.stubEnv("SNEAKERS_MOCK", "false");
    const outcome = await act({ intent: "mock-quick-login", userId: "mock-user-alice" }).catch(
      (error: unknown) => error,
    );
    expect(outcome).not.toBeInstanceOf(Response);
    const headers = new Headers((outcome as DataResult).init?.headers);
    expect(headers.get("Set-Cookie")).toBeNull();
  });
});
