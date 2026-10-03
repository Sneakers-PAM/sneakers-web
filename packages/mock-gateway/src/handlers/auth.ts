import { http, HttpResponse } from "msw";

import { addFactor, addNeedsStepUp } from "#mock/fixtures/staff/settings";
import { findUser, userById, WRONG_CODE } from "#mock/fixtures/users";
import { freshMfa } from "#mock/handlers/stepUp";
import {
  MOCK_GATEWAY_URL,
  MOCK_SESSION_COOKIE,
  type MockSession,
  mockState,
  newToken,
} from "#mock/state";

const at = (path: string) => `${MOCK_GATEWAY_URL}${path}`;

const json = (body: unknown, status = 200, headers?: HeadersInit) =>
  HttpResponse.json(body as never, { headers, status });
const refuse = (status: number, error: string) => json({ error }, status);

const readBody = async <T>(request: Request): Promise<T> => {
  try {
    return (await request.json()) as T;
  } catch {
    return {} as T;
  }
};

const sidOf = (request: Request): null | string => {
  const header = request.headers.get("Cookie") ?? "";
  const m = new RegExp(String.raw`(?:^|;\s*)${MOCK_SESSION_COOKIE}=([^;]+)`).exec(header);
  return m?.[1] ? decodeURIComponent(m[1]) : null;
};

const cookie = (sid: string, maxAge: number) =>
  `${MOCK_SESSION_COOKIE}=${sid}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}`;

/** The session behind a request, by cookie alone (the gateway's /auth/session check). */
export const sessionOf = (request: Request): MockSession | null => {
  const sid = sidOf(request);
  return sid ? (mockState.sessions.get(sid) ?? null) : null;
};

/** The session behind a request that also carries the right CSRF header. */
export const authed = (request: Request): MockSession | null => {
  const s = sessionOf(request);
  if (!s || request.headers.get("X-CSRF-Token") !== s.csrf) return null;
  return s;
};

/** Mint a session the way the gateway does, with the MFA posture for that user. */
export const mintSession = (
  userId: string,
  mfaVerified: boolean,
): { session: MockSession; sid: string } => {
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
  const sid = newToken("mock-sid");
  mockState.sessions.set(sid, s);
  return { session: s, sid };
};

const issue = (userId: string, mfaVerified: boolean) => {
  const { session: s, sid } = mintSession(userId, mfaVerified);
  return json(
    {
      csrfToken: s.csrf,
      userId,
      ...(s.enrollmentRequired ? { mfaEnrollmentRequired: true } : {}),
      ...(s.setupRecommended ? { mfaSetupRecommended: true } : {}),
    },
    200,
    { "Set-Cookie": cookie(sid, 1800) },
  );
};

const challenge = (userId: string) => {
  const pendingId = newToken("mock-pending");
  const factors = userById(userId)?.factors ?? ["totp"];
  mockState.pending.set(pendingId, { factors, userId });
  return { factors, pendingId };
};

export const authHandlers = [
  http.get(at("/setup/state"), () => json({ needsSetup: mockState.needsSetup })),

  http.get(at("/auth/session"), ({ request }) => {
    const s = sessionOf(request);
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

  http.post(at("/auth/login"), async ({ request }) => {
    const { password, username } = await readBody<{ password?: string; username?: string }>(
      request,
    );
    if (!username) return refuse(400, "invalid_request");
    const user = findUser(username);
    if (!user || !password) return refuse(401, "invalid_credentials");
    if (user.disabled) return refuse(403, "account_disabled");
    if (user.factors.length > 0) return json({ mfaRequired: true, ...challenge(user.id) });
    return issue(user.id, false);
  }),

  http.post(at("/auth/verify-otp"), async ({ request }) => {
    const { code, credentialJson, kind, pendingId } = await readBody<{
      code?: string;
      credentialJson?: string;
      kind?: string;
      pendingId?: string;
    }>(request);
    const p = pendingId ? mockState.pending.get(pendingId) : undefined;
    if (!p || !pendingId) return refuse(401, "invalid_pending");
    const factor = kind || "totp";
    const ok =
      p.factors.includes(factor) &&
      (factor === "passkey" ? !!credentialJson : !!code && code !== WRONG_CODE);
    if (!ok) return refuse(401, "invalid_code");
    mockState.pending.delete(pendingId);
    return issue(p.userId, true);
  }),

  http.post(at("/auth/mfa/otp/send"), async ({ request }) => {
    const { pendingId } = await readBody<{ pendingId?: string }>(request);
    if (!pendingId || !mockState.pending.has(pendingId)) return refuse(401, "invalid_pending");
    return json({ ok: true });
  }),

  http.post(at("/auth/mfa/webauthn/begin"), async ({ request }) => {
    const { pendingId } = await readBody<{ pendingId?: string }>(request);
    if (!pendingId || !mockState.pending.has(pendingId)) return refuse(401, "invalid_pending");
    return refuse(400, "no_passkey");
  }),

  http.post(at("/auth/logout"), ({ request }) => {
    const sid = sidOf(request);
    if (sid) mockState.sessions.delete(sid);
    return json({ status: "logged_out" }, 200, { "Set-Cookie": cookie("", -1) });
  }),

  http.post(at("/auth/mfa/enroll"), ({ request }) => {
    const s = authed(request);
    if (!s) return refuse(401, "no_session");
    if (addNeedsStepUp(s.userId) && !freshMfa(request)) return refuse(403, "step_up_required");
    const secret = "JBSWY3DPEHPK3PXP";
    mockState.enrollments.set(s.userId, secret);
    const user = userById(s.userId);
    return json({
      otpauthUri: `otpauth://totp/Sneakers-PAM:${user?.username ?? "user"}?secret=${secret}&issuer=Sneakers-PAM`,
      secret,
    });
  }),

  http.post(at("/auth/mfa/confirm"), async ({ request }) => {
    const s = authed(request);
    if (!s) return refuse(401, "no_session");
    const { code } = await readBody<{ code?: string }>(request);
    if (!code || code === WRONG_CODE || !mockState.enrollments.has(s.userId))
      return refuse(400, "invalid_code");
    addFactor(s.userId, "totp");
    Object.assign(s, {
      enrolled: true,
      enrollmentRequired: false,
      mfaVerified: true,
      mfaVerifiedAt: Date.now(),
      setupRecommended: false,
    });
    return json({ ok: true });
  }),

  http.post(at("/auth/mfa/webauthn/register/begin"), ({ request }) => {
    const s = authed(request);
    if (!s) return refuse(401, "no_session");
    if (addNeedsStepUp(s.userId) && !freshMfa(request)) return refuse(403, "step_up_required");
    return refuse(400, "no_passkey");
  }),

  http.post(at("/auth/reset/request"), () => json({ status: "ok" })),

  http.post(at("/auth/reset/confirm"), async ({ request }) => {
    const { code, newPassword } = await readBody<{ code?: string; newPassword?: string }>(request);
    if (!code || code === WRONG_CODE) return refuse(400, "invalid_code");
    if (!newPassword || newPassword.length < 8) return refuse(400, "weak_password");
    return json({ status: "ok" });
  }),
];
