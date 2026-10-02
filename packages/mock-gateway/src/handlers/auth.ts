import { http, HttpResponse } from "msw";

import { findUser, userById, WRONG_CODE } from "#mock/fixtures/users";
import { db, type MockSession, newToken, readSession, writeSession } from "#mock/state";

const json = (body: unknown, status = 200) => HttpResponse.json(body as never, { status });
const error = (status: number, error: string) => json({ error }, status);

const body = async <T>(request: Request): Promise<T> => {
  try {
    return (await request.json()) as T;
  } catch {
    return {} as T;
  }
};

/** Mint a session the way the gateway does, with the MFA posture for that user. */
const issue = (userId: string, mfaVerified: boolean): MockSession => {
  const user = userById(userId);
  const enrolled = mfaVerified || (user?.factors.length ?? 0) > 0;
  const s: MockSession = {
    csrf: newToken("mock-csrf"),
    enrolled,
    enrollmentRequired: !!user?.mustEnroll && !enrolled,
    mfaVerified,
    setupRecommended: !user?.mustEnroll && !enrolled,
    userId,
  };
  writeSession(s);
  return s;
};

const issued = (s: MockSession) =>
  json({
    csrfToken: s.csrf,
    userId: s.userId,
    ...(s.enrollmentRequired ? { mfaEnrollmentRequired: true } : {}),
    ...(s.setupRecommended ? { mfaSetupRecommended: true } : {}),
  });

/** The session behind a request that needs the CSRF header, or null. */
export const authed = (request: Request): MockSession | null => {
  const s = readSession();
  if (!s) return null;
  if (request.headers.get("X-CSRF-Token") !== s.csrf) return null;
  return s;
};

export const challenge = (userId: string): { factors: string[]; pendingId: string } => {
  const user = userById(userId);
  const pendingId = newToken("mock-pending");
  const factors = user?.factors ?? ["totp"];
  db.pending.set(pendingId, { factors, userId });
  return { factors, pendingId };
};

export const authHandlers = [
  http.get("/setup/state", () => json({ needsSetup: db.needsSetup })),

  http.get("/auth/session", () => {
    const s = readSession();
    if (!s) return json({ authenticated: false });
    return json({
      authenticated: true,
      csrfToken: s.csrf,
      enrolled: s.enrolled,
      mfaEnrollmentRequired: s.enrollmentRequired,
      mfaSetupRecommended: s.setupRecommended,
      userId: s.userId,
    });
  }),

  http.post("/auth/login", async ({ request }) => {
    const { password, username } = await body<{ password?: string; username?: string }>(request);
    if (!username) return error(400, "invalid_request");
    const user = findUser(username);
    if (!user || !password) return error(401, "invalid_credentials");
    if (user.disabled) return error(403, "account_disabled");
    if (user.factors.length > 0) {
      return json({ mfaRequired: true, ...challenge(user.id) });
    }
    return issued(issue(user.id, false));
  }),

  http.post("/auth/verify-otp", async ({ request }) => {
    const { code, credentialJson, kind, pendingId } = await body<{
      code?: string;
      credentialJson?: string;
      kind?: string;
      pendingId?: string;
    }>(request);
    const p = pendingId ? db.pending.get(pendingId) : undefined;
    if (!p || !pendingId) return error(401, "invalid_pending");
    const factor = kind || "totp";
    const ok =
      p.factors.includes(factor) &&
      (factor === "passkey" ? !!credentialJson : !!code && code !== WRONG_CODE);
    if (!ok) return error(401, "invalid_code");
    db.pending.delete(pendingId);
    return issued(issue(p.userId, true));
  }),

  http.post("/auth/mfa/otp/send", async ({ request }) => {
    const { pendingId } = await body<{ pendingId?: string }>(request);
    if (!pendingId || !db.pending.has(pendingId)) return error(401, "invalid_pending");
    return json({ ok: true });
  }),

  http.post("/auth/mfa/webauthn/begin", async ({ request }) => {
    const { pendingId } = await body<{ pendingId?: string }>(request);
    if (!pendingId || !db.pending.has(pendingId)) return error(401, "invalid_pending");
    return error(400, "no_passkey");
  }),

  http.post("/auth/logout", () => {
    writeSession(null);
    return json({ status: "logged_out" });
  }),

  http.post("/auth/mfa/enroll", ({ request }) => {
    const s = authed(request);
    if (!s) return error(401, "no_session");
    const secret = "JBSWY3DPEHPK3PXP";
    db.enrollments.set(s.userId, secret);
    const user = userById(s.userId);
    return json({
      otpauthUri: `otpauth://totp/Sneakers-PAM:${user?.username ?? "user"}?secret=${secret}&issuer=Sneakers-PAM`,
      secret,
    });
  }),

  http.post("/auth/mfa/confirm", async ({ request }) => {
    const s = authed(request);
    if (!s) return error(401, "no_session");
    const { code } = await body<{ code?: string }>(request);
    if (!code || code === WRONG_CODE || !db.enrollments.has(s.userId))
      return error(400, "invalid_code");
    writeSession({
      ...s,
      enrolled: true,
      enrollmentRequired: false,
      mfaVerified: true,
      setupRecommended: false,
    });
    return json({ ok: true });
  }),

  http.post("/auth/mfa/webauthn/register/begin", ({ request }) => {
    if (!authed(request)) return error(401, "no_session");
    return error(400, "no_passkey");
  }),

  http.post("/auth/reset/request", () => json({ status: "ok" })),

  http.post("/auth/reset/confirm", async ({ request }) => {
    const { code, newPassword } = await body<{ code?: string; newPassword?: string }>(request);
    if (!code || code === WRONG_CODE) return error(400, "invalid_code");
    if (!newPassword || newPassword.length < 8) return error(400, "weak_password");
    return json({ status: "ok" });
  }),
];
