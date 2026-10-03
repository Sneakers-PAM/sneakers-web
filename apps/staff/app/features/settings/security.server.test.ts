// @vitest-environment node
import { MOCK_GATEWAY_URL, USERS } from "@sneakers-web/mock-gateway";
import {
  appRequest,
  form,
  server,
  sessionCookie,
  withMockGateway,
} from "@sneakers-web/mock-gateway/testing";
import { http, HttpResponse } from "msw";

import { loadSecurity, securityAction } from "@/features/settings/security.server";

withMockGateway();

const get = (path: string, cookie = sessionCookie("mock-user-alice")) =>
  appRequest(path, { cookie });
const post = (fields: Record<string, string>, cookie = sessionCookie("mock-user-alice")) =>
  appRequest("/security", { body: form(fields), cookie, method: "POST" });

const stepUp = (cookie: string) =>
  fetch(`${MOCK_GATEWAY_URL}/auth/session`, { headers: { Cookie: cookie } })
    .then((r) => r.json() as Promise<{ csrfToken: string }>)
    .then(({ csrfToken }) =>
      fetch(`${MOCK_GATEWAY_URL}/auth/mfa/step-up`, {
        body: JSON.stringify({ code: "123456", kind: "totp" }),
        headers: { "Content-Type": "application/json", Cookie: cookie, "X-CSRF-Token": csrfToken },
        method: "POST",
      }),
    );

const user = (id: string) => USERS.find((u) => u.id === id)!;

describe("the security loader", () => {
  it("lists the user's own factors with their email", async () => {
    const d = await loadSecurity(get("/security"));
    expect(d.listed).toBe(true);
    expect(d.email).toBe("alice@example.org");
    expect(d.factors.map((f) => f.kind)).toEqual(["totp", "email"]);
    expect(d.factors[0]?.createdAt).toBeTruthy();
    expect(d.setup).toBe(false);
  });

  it("lists only email codes for someone without TOTP or a passkey", async () => {
    const d = await loadSecurity(get("/security", sessionCookie("mock-user-bob")));
    expect(d.factors.map((f) => f.kind)).toEqual(["email"]);
  });

  it("opens the authenticator setup for ?setup=authenticator", async () => {
    const d = await loadSecurity(get("/security?setup=authenticator"));
    expect(d.setup).toBe(true);
  });

  it("falls back to the session's posture on a gateway without the factor list", async () => {
    server.use(
      http.get(`${MOCK_GATEWAY_URL}/auth/mfa/factors`, () =>
        HttpResponse.json({ error: "not_found" }, { status: 404 }),
      ),
    );
    const d = await loadSecurity(get("/security"));
    expect(d.listed).toBe(false);
    expect(d.factors.map((f) => [f.kind, f.createdAt])).toEqual([
      ["totp", null],
      ["email", null],
    ]);
  });

  it("throws on any other gateway failure, for the page's error state", async () => {
    server.use(
      http.get(`${MOCK_GATEWAY_URL}/auth/mfa/factors`, () =>
        HttpResponse.json({ error: "identity_unreachable" }, { status: 502 }),
      ),
    );
    await expect(loadSecurity(get("/security"))).rejects.toThrow();
  });
});

describe("the security action", () => {
  it("asks for a step-up before removing the authenticator", async () => {
    const r = await securityAction(post({ intent: "remove-totp" }));
    expect(r).toMatchObject({
      intent: "remove-totp",
      ok: false,
      refusal: { reason: "STEP_UP_REQUIRED" },
    });
    expect(user("mock-user-alice").factors).toContain("totp");
  });

  it("removes the authenticator after a step-up and sends the person to sign in", async () => {
    const cookie = sessionCookie("mock-user-alice");
    await stepUp(cookie);
    const r = await securityAction(post({ intent: "remove-totp" }, cookie)).catch(
      (error: unknown) => error,
    );
    expect(r).toBeInstanceOf(Response);
    const response = r as Response;
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/sign-in?ended=1&next=%2Fsecurity");
    expect(response.headers.get("Set-Cookie")).toMatch(/Max-Age=-1/);
    expect(user("mock-user-alice").factors).toEqual(["email"]);
  });

  it("says why the last factor of someone who must use MFA can't go", async () => {
    user("mock-user-dave").factors = ["totp", "email"];
    const cookie = sessionCookie("mock-user-dave");
    await stepUp(cookie);
    const r = await securityAction(post({ intent: "remove-totp" }, cookie));
    expect(r).toMatchObject({ ok: false, refusal: { reason: "MFA_LAST_FACTOR" } });
    expect(user("mock-user-dave").factors).toEqual(["totp", "email"]);
  });

  it("starts and confirms an authenticator for someone with no factor", async () => {
    const cookie = sessionCookie("mock-user-bob");
    const begun = await securityAction(post({ intent: "totp-begin" }, cookie));
    expect(begun).toMatchObject({ intent: "totp-begin", ok: true });
    expect(begun.ok && begun.enrollment?.otpauthUri).toMatch(/^otpauth:\/\//);
    const wrong = await securityAction(post({ code: "000000", intent: "totp-confirm" }, cookie));
    expect(wrong).toEqual({ intent: "totp-confirm", ok: false, wrong: true });
    const done = await securityAction(post({ code: "123456", intent: "totp-confirm" }, cookie));
    expect(done).toEqual({ done: "Authenticator app added.", intent: "totp-confirm", ok: true });
    expect(user("mock-user-bob").factors).toEqual(["totp"]);
  });

  it("asks for a step-up before someone with a factor adds another", async () => {
    const r = await securityAction(post({ intent: "passkey-begin" }));
    expect(r).toMatchObject({ ok: false, refusal: { reason: "STEP_UP_REQUIRED" } });
  });

  it("says plainly when the server can't register a passkey", async () => {
    const cookie = sessionCookie("mock-user-bob");
    const r = await securityAction(post({ intent: "passkey-begin" }, cookie));
    expect(r).toMatchObject({
      ok: false,
      refusal: { detail: "passkeys aren't available on this server right now" },
    });
  });

  it("refuses an unknown intent", async () => {
    expect(await securityAction(post({ intent: "nope" }))).toMatchObject({ ok: false });
  });
});
