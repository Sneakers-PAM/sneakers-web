import type { GatewayClient } from "#api/gateway";

import { ApiError } from "#api/errors";
import { createLogger } from "#api/log";

const log = createLogger("auth");

/*
 * The gateway's sign-in routes (/auth/*). The gateway does the work with Ory: Kratos holds
 * passwords and second factors, Polis brokers SAML single sign-on. These run on the app
 * server; the browser only ever holds the HttpOnly session cookie.
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

export type ResetResult =
  { ok: false; reason: "invalid_code" | "unavailable" | "weak_password" } | { ok: true };

export type SecondFactor = "email" | "passkey" | "totp";

export interface SessionInfo extends MfaPosture {
  authenticated: boolean;
  /** The user has a confirmed factor (so "remove authenticator" has something to remove). */
  enrolled: boolean;
  userId: null | string;
}

export type SsoReturn =
  | { factors: SecondFactor[]; kind: "challenge"; pendingId: string }
  | { kind: "failed"; reason: string };

export interface TotpEnrollment {
  otpauthUri: string;
  secret: string;
}

const FACTORS = new Set<SecondFactor>(["email", "passkey", "totp"]);

const factorList = (raw: unknown): SecondFactor[] =>
  Array.isArray(raw) ? raw.filter((f): f is SecondFactor => FACTORS.has(f as SecondFactor)) : [];

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

const NO_SESSION: SessionInfo = {
  authenticated: false,
  enrolled: false,
  enrollmentRequired: false,
  setupRecommended: false,
  userId: null,
};

/** The current session. Keeps the CSRF token on the client for the calls that follow. */
export const getSession = async (gw: GatewayClient): Promise<SessionInfo> => {
  if (!gw.hasSessionCookie) return NO_SESSION;
  const s = await gw.request<SessionWire>("/auth/session");
  if (s.authenticated && s.csrfToken) gw.setCsrf(s.csrfToken);
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
export const login = async (
  gw: GatewayClient,
  username: string,
  password: string,
): Promise<LoginResult> => {
  try {
    const r = await gw.request<IssuedWire>("/auth/login", { body: { password, username } });
    if (r.mfaRequired && r.pendingId) {
      log.info("password accepted, second factor needed");
      return { factors: factorList(r.factors), kind: "challenge", pendingId: r.pendingId };
    }
    gw.setCsrf(r.csrfToken ?? "");
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
    if (error instanceof ApiError && error.code === "account_disabled")
      return { kind: "rejected", reason: "disabled" };
    throw error;
  }
};

/** The second-factor step of a login. False means the code didn't match. */
export const verifySecondFactor = async (
  gw: GatewayClient,
  pendingId: string,
  factor: SecondFactor,
  proof: string,
): Promise<boolean> => {
  try {
    const body =
      factor === "passkey"
        ? { credentialJson: proof, kind: factor, pendingId }
        : { code: proof, kind: factor, pendingId };
    const r = await gw.request<IssuedWire>("/auth/verify-otp", { body });
    gw.setCsrf(r.csrfToken ?? "");
    log.info("second factor verified", { factor });
    return true;
  } catch (error) {
    if (error instanceof ApiError && error.code === "invalid_code") return false;
    throw error;
  }
};

/** Email a login code for a pending challenge. "wait" means one was sent a moment ago. */
export const sendLoginEmailCode = async (
  gw: GatewayClient,
  pendingId: string,
): Promise<"sent" | "wait"> => {
  try {
    await gw.request("/auth/mfa/otp/send", { body: { pendingId } });
    return "sent";
  } catch (error) {
    if (error instanceof ApiError && error.status === 429) return "wait";
    throw error;
  }
};

/** Start a passkey assertion for a pending challenge. Returns the WebAuthn options JSON. */
export const beginPasskeyLogin = async (gw: GatewayClient, pendingId: string): Promise<string> => {
  const r = await gw.request<{ optionsJson?: string }>("/auth/mfa/webauthn/begin", {
    body: { pendingId },
  });
  return r.optionsJson ?? "";
};

export const logout = async (gw: GatewayClient): Promise<void> => {
  await gw.request("/auth/logout", { body: {}, method: "POST" });
  log.info("signed out");
};

/** Begin authenticator-app enrolment for the signed-in (or half signed-in) user. */
export const beginTotpEnrollment = async (gw: GatewayClient): Promise<TotpEnrollment> => {
  const r = await gw.request<{ otpauthUri?: string; secret?: string }>("/auth/mfa/enroll", {
    body: {},
    csrf: true,
  });
  return { otpauthUri: r.otpauthUri ?? "", secret: r.secret ?? "" };
};

/** Prove the new authenticator with one current code. False means the code didn't match. */
export const confirmTotpEnrollment = async (gw: GatewayClient, code: string): Promise<boolean> => {
  try {
    await gw.request("/auth/mfa/confirm", { body: { code }, csrf: true });
    log.info("authenticator enrolled");
    return true;
  } catch (error) {
    if (error instanceof ApiError && error.code === "invalid_code") return false;
    throw error;
  }
};

/** Begin passkey registration for the signed-in user. */
export const beginPasskeyEnrollment = async (
  gw: GatewayClient,
): Promise<{ optionsJson: string; sessionId: string }> => {
  const r = await gw.request<{ optionsJson?: string; sessionId?: string }>(
    "/auth/mfa/webauthn/register/begin",
    {
      body: {},
      csrf: true,
    },
  );
  return { optionsJson: r.optionsJson ?? "", sessionId: r.sessionId ?? "" };
};

export const finishPasskeyEnrollment = async (
  gw: GatewayClient,
  sessionId: string,
  credentialJson: string,
  label: string,
): Promise<void> => {
  await gw.request("/auth/mfa/webauthn/register/finish", {
    body: { credentialJson, label, sessionId },
    csrf: true,
  });
  log.info("passkey enrolled");
};

/** Start a self-service password reset. The answer never says whether the account exists. */
export const requestPasswordReset = async (gw: GatewayClient, email: string): Promise<void> => {
  await gw.request("/auth/reset/request", { body: { email } });
};

export const confirmPasswordReset = async (
  gw: GatewayClient,
  email: string,
  code: string,
  newPassword: string,
): Promise<ResetResult> => {
  try {
    await gw.request("/auth/reset/confirm", { body: { code, email, newPassword } });
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
