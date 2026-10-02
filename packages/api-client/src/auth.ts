import { clearCsrf, setCsrf } from "#api/csrf";
import { ApiError } from "#api/errors";
import { requestJson } from "#api/http";
import { createLogger } from "#api/log";

const log = createLogger("auth");

/**
 * The gateway's sign-in routes (/auth/*). The gateway does the work with Ory: Kratos holds
 * passwords and second factors, Polis brokers SAML single sign-on. The browser only ever
 * holds the HttpOnly session cookie and, in memory, the CSRF token.
 */

export type LoginResult =
  | { factors: SecondFactor[]; kind: "challenge"; pendingId: string }
  | { kind: "rejected"; reason: "disabled" | "invalid" }
  | ({ kind: "session"; userId: string } & MfaPosture);

export interface MfaPosture {
  /** MFA is enforced and this session has no verified factor: only enrolment is allowed. */
  enrollmentRequired: boolean;
  /** MFA is optional and the user has no factor yet: show the setup nudge. */
  setupRecommended: boolean;
}

export type SecondFactor = "email" | "passkey" | "totp";

export interface SessionInfo extends MfaPosture {
  authenticated: boolean;
  /** The user has a confirmed factor (so "remove authenticator" has something to remove). */
  enrolled: boolean;
  userId: null | string;
}

const FACTORS: Set<SecondFactor> = new Set(["email", "passkey", "totp"]);
const factorList = (raw: unknown): SecondFactor[] =>
  Array.isArray(raw) ? raw.filter((f): f is SecondFactor => FACTORS.has(f as SecondFactor)) : [];

export type ResetResult =
  { ok: false; reason: "invalid_code" | "unavailable" | "weak_password" } | { ok: true };

export interface TotpEnrollment {
  otpauthUri: string;
  secret: string;
}

interface IssuedWire {
  csrfToken?: string;
  factors?: unknown;
  mfaEnrollmentRequired?: boolean;
  mfaRequired?: boolean;
  mfaSetupRecommended?: boolean;
  pendingId?: string;
  userId?: string;
}

interface SessionWire {
  authenticated?: boolean;
  csrfToken?: string;
  enrolled?: boolean;
  mfaEnrollmentRequired?: boolean;
  mfaSetupRecommended?: boolean;
  userId?: string;
}

/** Begin passkey registration for the signed-in user. */
export const beginPasskeyEnrollment = async (): Promise<{
  optionsJson: string;
  sessionId: string;
}> => {
  const r = await requestJson<{ optionsJson?: string; sessionId?: string }>(
    "/auth/mfa/webauthn/register/begin",
    { body: {}, csrf: true, method: "POST", quietAuth: true },
  );
  return { optionsJson: r.optionsJson ?? "", sessionId: r.sessionId ?? "" };
};

/** Start a passkey assertion for a pending challenge. Returns the WebAuthn options JSON. */
export const beginPasskeyLogin = async (pendingId: string): Promise<string> => {
  const r = await requestJson<{ optionsJson?: string }>("/auth/mfa/webauthn/begin", {
    body: { pendingId },
    quietAuth: true,
  });
  return r.optionsJson ?? "";
};

/** Begin authenticator-app enrolment for the signed-in (or half signed-in) user. */
export const beginTotpEnrollment = async (): Promise<TotpEnrollment> => {
  const r = await requestJson<{ otpauthUri?: string; secret?: string }>("/auth/mfa/enroll", {
    body: {},
    csrf: true,
    method: "POST",
    quietAuth: true,
  });
  return { otpauthUri: r.otpauthUri ?? "", secret: r.secret ?? "" };
};

export const confirmPasswordReset = async (
  email: string,
  code: string,
  newPassword: string,
): Promise<ResetResult> => {
  try {
    await requestJson("/auth/reset/confirm", {
      body: { code, email, newPassword },
      quietAuth: true,
    });
    return { ok: true };
  } catch (error) {
    if (
      error instanceof ApiError &&
      (error.code === "invalid_code" || error.code === "weak_password")
    ) {
      return { ok: false, reason: error.code };
    }
    if (error instanceof ApiError) return { ok: false, reason: "unavailable" };
    throw error;
  }
};

/** Prove the new authenticator with one current code. False means the code didn't match. */
export const confirmTotpEnrollment = async (code: string): Promise<boolean> => {
  try {
    await requestJson("/auth/mfa/confirm", { body: { code }, csrf: true, quietAuth: true });
    log.info("authenticator enrolled");
    return true;
  } catch (error) {
    if (error instanceof ApiError && error.code === "invalid_code") return false;
    throw error;
  }
};

export const finishPasskeyEnrollment = async (
  sessionId: string,
  credentialJson: string,
  label: string,
): Promise<void> => {
  await requestJson("/auth/mfa/webauthn/register/finish", {
    body: { credentialJson, label, sessionId },
    csrf: true,
    quietAuth: true,
  });
  log.info("passkey enrolled");
};

/** The current session, read from the cookie. Restores the CSRF token on a page reload. */
export const getSession = async (): Promise<SessionInfo> => {
  const s = await requestJson<SessionWire>("/auth/session", { quietAuth: true });
  if (s.authenticated && s.csrfToken) setCsrf(s.csrfToken);
  log.debug("session read", { authenticated: !!s.authenticated });
  return {
    authenticated: !!s.authenticated,
    enrolled: !!s.enrolled,
    enrollmentRequired: !!s.mfaEnrollmentRequired,
    setupRecommended: !!s.mfaSetupRecommended,
    userId: s.userId ?? null,
  };
};

/** The password step. A user with a factor gets a challenge instead of a session. */
export const login = async (username: string, password: string): Promise<LoginResult> => {
  try {
    const r = await requestJson<IssuedWire>("/auth/login", {
      body: { password, username },
      quietAuth: true,
    });
    if (r.mfaRequired && r.pendingId) {
      log.info("password accepted, second factor needed");
      return { factors: factorList(r.factors), kind: "challenge", pendingId: r.pendingId };
    }
    setCsrf(r.csrfToken ?? "");
    log.info("signed in with a password");
    return {
      enrollmentRequired: !!r.mfaEnrollmentRequired,
      kind: "session",
      setupRecommended: !!r.mfaSetupRecommended,
      userId: r.userId ?? "",
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401)
      return { kind: "rejected", reason: "invalid" };
    if (error instanceof ApiError && error.code === "account_disabled") {
      return { kind: "rejected", reason: "disabled" };
    }
    throw error;
  }
};

export const logout = async (): Promise<void> => {
  try {
    await requestJson("/auth/logout", { body: {}, method: "POST", quietAuth: true });
  } finally {
    clearCsrf();
    log.info("signed out");
  }
};

/** Start a self-service password reset. The answer never says whether the account exists. */
export const requestPasswordReset = async (email: string): Promise<void> => {
  await requestJson("/auth/reset/request", { body: { email }, quietAuth: true });
};

/** Email a login code for a pending challenge. "wait" means one was sent a moment ago. */
export const sendLoginEmailCode = async (pendingId: string): Promise<"sent" | "wait"> => {
  try {
    await requestJson("/auth/mfa/otp/send", { body: { pendingId }, quietAuth: true });
    return "sent";
  } catch (error) {
    if (error instanceof ApiError && error.status === 429) return "wait";
    throw error;
  }
};

/** The second-factor step of a login. False means the code didn't match. */
export const verifySecondFactor = async (
  pendingId: string,
  factor: SecondFactor,
  proof: string,
): Promise<boolean> => {
  try {
    const body =
      factor === "passkey"
        ? { credentialJson: proof, kind: factor, pendingId }
        : { code: proof, kind: factor, pendingId };
    const r = await requestJson<IssuedWire>("/auth/verify-otp", { body, quietAuth: true });
    setCsrf(r.csrfToken ?? "");
    log.info("second factor verified", { factor });
    return true;
  } catch (error) {
    if (error instanceof ApiError && error.code === "invalid_code") return false;
    throw error;
  }
};

/** The gateway route that starts SAML single sign-on. It is a full-page redirect. */
export const SSO_LOGIN_PATH = "/auth/sso/login";

export type SsoReturn =
  | { factors: SecondFactor[]; kind: "challenge"; pendingId: string }
  | { kind: "failed"; reason: string };

/**
 * Read what the SSO callback put on the URL when it sent the browser back: a second-factor
 * challenge (`sso_pending` and `factors`) or a failure (`sso_error`).
 */
export const readSsoReturn = (search: string): null | SsoReturn => {
  const q = new URLSearchParams(search);
  const pending = q.get("sso_pending");
  if (pending) {
    return {
      factors: factorList((q.get("factors") ?? "").split(",")),
      kind: "challenge",
      pendingId: pending,
    };
  }
  const error = q.get("sso_error");
  if (error) return { kind: "failed", reason: error };
  return null;
};
