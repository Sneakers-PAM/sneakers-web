// @vitest-environment node
import { mockState } from "@sneakers-web/mock-gateway";
import {
  appRequest,
  form,
  sessionCookie,
  withMockGateway,
} from "@sneakers-web/mock-gateway/testing";

import {
  approvalsAction,
  grantsAction,
  loadApprovals,
  loadGrants,
  loadTokens,
  tokensAction,
} from "@/features/agents/agents.server";
import { consentAction, loadConsent } from "@/features/agents/consent.server";

withMockGateway();

const get = (path: string, user = "mock-user-alice") =>
  appRequest(path, { cookie: sessionCookie(user) });
const post = (path: string, fields: Record<string, string>, user = "mock-user-alice") =>
  appRequest(path, { body: form(fields), cookie: sessionCookie(user), method: "POST" });

const freshCookie = (user = "mock-user-alice") => {
  const cookie = sessionCookie(user);
  for (const s of mockState.sessions.values()) if (s.userId === user) s.mfaVerifiedAt = Date.now();
  return cookie;
};
const freshGet = (path: string) => appRequest(path, { cookie: freshCookie() });
const freshPost = (path: string, fields: Record<string, string>) =>
  appRequest(path, { body: form(fields), cookie: freshCookie(), method: "POST" });

const world = () => mockState.world;
const CAROL = "mock-user-carol";
const nowUnix = () => Math.floor(Date.now() / 1000);

describe("the tokens page", () => {
  it("lists the user's tokens newest first, with their state", async () => {
    const { tokens } = await loadTokens(get("/tokens"));
    expect(tokens.map((t) => [t.label, t.state])).toEqual([
      ["build1 agent", "active"],
      ["old laptop", "expired"],
    ]);
  });

  it("revokes a token and says so", async () => {
    const r = await tokensAction(post("/tokens", { id: "mock-token-1", intent: "revoke" }));
    expect(r).toMatchObject({ intent: "revoke", ok: true });
    expect(world().tokens.find((t) => t.id === "mock-token-1")?.revokedAtUnix).toBeGreaterThan(0);
  });

  it("hands back a refusal as data", async () => {
    const r = await tokensAction(post("/tokens", { id: "mock-token-3", intent: "revoke" }));
    expect(r).toMatchObject({ ok: false, refusal: { code: "NOT_FOUND" } });
  });
});

describe("the approvals page", () => {
  it("lists what the user may decide and their own requests, soonest to expire first", async () => {
    world().secretUses.push({
      ...world().secretUses[0]!,
      expiresAtUnix: nowUnix() + 30,
      id: "mock-use-soon",
      reveal: true,
    });
    const carol = await loadApprovals(get("/approvals", CAROL));
    expect(carol.toDecide.map((u) => u.id)).toEqual(["mock-use-soon", "mock-use-1"]);
    expect(carol.toDecide[1]).toMatchObject({
      command: "psql -h db1.example.org -U postgres_admin",
      requestedBy: "Alice",
    });
    const alice = await loadApprovals(get("/approvals"));
    expect(alice.toDecide).toEqual([]);
    expect(alice.mine.map((u) => u.id)).toEqual(["mock-use-soon", "mock-use-1"]);
  });

  it("approves someone else's request with the factor from the form", async () => {
    const r = await approvalsAction(
      post(
        "/approvals",
        { code: "123456", factor: "totp", id: "mock-use-1", intent: "approve" },
        CAROL,
      ),
    );
    expect(r).toMatchObject({ intent: "approve", ok: true });
    expect(world().secretUses[0]?.state).toBe("approved");
  });

  it("never approves the user's own request", async () => {
    const r = await approvalsAction(
      post("/approvals", { code: "123456", factor: "totp", id: "mock-use-1", intent: "approve" }),
    );
    expect(r).toMatchObject({ ok: false, refusal: { reason: "SELF_APPROVAL" } });
    expect(world().secretUses[0]?.state).toBe("pending");
  });

  it("withdraws the user's own request", async () => {
    const r = await approvalsAction(post("/approvals", { id: "mock-use-1", intent: "withdraw" }));
    expect(r).toMatchObject({ intent: "withdraw", ok: true });
    expect(world().secretUses[0]?.state).toBe("denied");
  });

  it("keeps the dialog's problem when the factor is wrong", async () => {
    const r = await approvalsAction(
      post(
        "/approvals",
        { code: "000000", factor: "totp", id: "mock-use-1", intent: "approve" },
        CAROL,
      ),
    );
    expect(r).toMatchObject({ factorRejected: true, ok: false });
    expect(r.ok === false && r.message).toBe("Second factor was not accepted.");
    expect(world().secretUses[0]?.state).toBe("pending");
  });

  it("denies without a factor", async () => {
    const r = await approvalsAction(
      post("/approvals", { id: "mock-use-1", intent: "deny" }, CAROL),
    );
    expect(r).toMatchObject({ intent: "deny", ok: true });
    expect(world().secretUses[0]?.state).toBe("denied");
  });

  it("emails a code for the factor", async () => {
    const r = await approvalsAction(post("/approvals", { intent: "factor-email" }));
    expect(r).toMatchObject({ intent: "factor-email", ok: true });
  });
});

describe("the grants page", () => {
  it("names each grant's token and secrets, and offers only active tokens", async () => {
    const d = await loadGrants(get("/grants"));
    expect(d.grants).toEqual([
      expect.objectContaining({
        id: "mock-grant-1",
        programs: ["psql -h db1.example.org"],
        scope: "DB admin",
        state: "active",
        token: "build1 agent",
        uses: "3 / 20",
      }),
    ]);
    expect(d.tokens.map((t) => t.id)).toEqual(["mock-token-1"]);
    expect(d.secrets.find((s) => s.id === "mock-secret-db-admin")).toMatchObject({
      name: "DB admin",
    });
    expect(d.folders.length).toBeGreaterThan(0);
  });

  it("creates a grant for the chosen window and factor", async () => {
    const r = await grantsAction(
      post("/grants", {
        allowReveal: "false",
        code: "123456",
        factor: "totp",
        fieldKeys: "password",
        hours: "4",
        intent: "create",
        maxUses: "5",
        programs: JSON.stringify([{ argPattern: "", program: "psql" }]),
        scope: "secrets",
        secretIds: "mock-secret-db-admin",
        tokenId: "mock-token-1",
      }),
    );
    expect(r).toMatchObject({ intent: "create", ok: true });
    const g = world().useGrants.at(-1)!;
    expect(g).toMatchObject({
      fieldKeys: ["password"],
      maxUses: 5,
      secretIds: ["mock-secret-db-admin"],
    });
    expect(g.programs).toEqual([{ args: ["*"], path: "psql" }]);
    expect(g.expiresAtUnix - nowUnix()).toBeGreaterThan(4 * 3600 - 10);
  });

  it("hands back the vault's refusal of a bad grant", async () => {
    const r = await grantsAction(
      post("/grants", {
        code: "123456",
        factor: "totp",
        hours: "4",
        intent: "create",
        programs: JSON.stringify([{ argPattern: "*", program: "../psql" }]),
        scope: "secrets",
        secretIds: "mock-secret-db-admin",
        tokenId: "mock-token-1",
      }),
    );
    expect(r).toMatchObject({
      factorRejected: false,
      ok: false,
      refusal: { code: "INVALID_ARGUMENT" },
    });
  });

  it("revokes a grant", async () => {
    const r = await grantsAction(post("/grants", { id: "mock-grant-1", intent: "revoke" }));
    expect(r).toMatchObject({ ok: true });
    expect(world().useGrants[0]?.revokedAtUnix).toBeGreaterThan(0);
  });
});

describe("the consent page", () => {
  it("names the app for a live request", async () => {
    const d = await loadConsent(get("/oauth/consent?req=mock-consent-1"));
    expect(d).toMatchObject({
      clientName: "MCP client",
      redirectHost: "127.0.0.1:53682",
      user: { email: "alice@example.org", name: "Alice" },
      view: "form",
    });
  });

  it("says when there's no request, or it has expired", async () => {
    const none = await loadConsent(get("/oauth/consent"));
    expect(none.view).toBe("no-request");
    const late = await loadConsent(get("/oauth/consent?req=mock-consent-expired"));
    expect(late.view).toBe("expired");
  });

  it("sends a sign-in without a session to sign-in, coming back here", async () => {
    const thrown = await loadConsent(appRequest("/oauth/consent?req=mock-consent-1")).catch(
      (error: unknown) => error,
    );
    expect(thrown).toBeInstanceOf(Response);
    const location = (thrown as Response).headers.get("Location") ?? "";
    expect(new URL(location, "https://app.example.invalid").searchParams.get("next")).toBe(
      "/oauth/consent?req=mock-consent-1",
    );
  });

  it("allows with a factor and returns the app's address", async () => {
    const wrong = await consentAction(
      post("/oauth/consent?req=mock-consent-1", {
        code: "000000",
        factor: "totp",
        intent: "allow",
        label: "laptop agent",
      }),
    );
    expect(wrong).toEqual({ problem: "code" });
    const r = await consentAction(
      post("/oauth/consent?req=mock-consent-1", {
        code: "123456",
        factor: "totp",
        intent: "allow",
        label: "laptop agent",
      }),
    );
    expect(r).toMatchObject({ label: "laptop agent", view: "done" });
    expect("redirect" in r && new URL(r.redirect).searchParams.get("code")).toMatch(/^mock-code-/);
  });

  it("denies, and says when the request ran out", async () => {
    const r = await consentAction(post("/oauth/consent?req=mock-consent-1", { intent: "deny" }));
    expect(r).toMatchObject({ view: "denied" });
    const again = await consentAction(
      post("/oauth/consent?req=mock-consent-1", {
        code: "123456",
        factor: "totp",
        intent: "allow",
      }),
    );
    expect(again).toEqual({ problem: "expired" });
  });

  it("asks for a factor only when the sign-in one is older than the step-up window", async () => {
    const stale = await loadConsent(get("/oauth/consent?req=mock-consent-1"));
    expect(stale).toMatchObject({ factorRequired: true, view: "form" });
    const fresh = await loadConsent(freshGet("/oauth/consent?req=mock-consent-1"));
    expect(fresh).toMatchObject({ factorRequired: false, view: "form" });
  });

  it("allows without a factor while the session's is fresh", async () => {
    const r = await consentAction(
      freshPost("/oauth/consent?req=mock-consent-1", { intent: "allow", label: "laptop agent" }),
    );
    expect(r).toMatchObject({ label: "laptop agent", view: "done" });
  });

  it("asks for a step-up when no factor is given and the session's is stale", async () => {
    const r = await consentAction(
      post("/oauth/consent?req=mock-consent-1", { intent: "allow", label: "laptop agent" }),
    );
    expect(r).toEqual({ problem: "step-up" });
    expect(world().tokens.some((t) => t.label === "laptop agent")).toBe(false);
  });

  it("emails a code for the consent", async () => {
    expect(
      await consentAction(post("/oauth/consent?req=mock-consent-1", { intent: "email" })),
    ).toEqual({ emailSent: true });
  });
});
