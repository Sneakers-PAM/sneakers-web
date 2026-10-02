import type { GatewayClient } from "#api/gateway";

import { ApiError } from "#api/errors";
import { createLogger } from "#api/log";

const log = createLogger("step-up");

/** A fresh second-factor proof for a step-up: a code, or a passkey assertion. */
export type StepUpProof =
  | { code: string; kind: "email" | "totp" }
  | { credentialJson: string; kind: "passkey"; webauthnSessionId: string };

/**
 * "ok": the session now carries a fresh second factor. "wrong": the proof didn't match.
 * "revoked": too many wrong proofs, so the gateway ended the session.
 */
export type StepUpResult = "ok" | "revoked" | "wrong";

/**
 * Prove a second factor again (POST /auth/mfa/step-up), so the vault sees a fresh MFA on the
 * reveal, check-out or recovery call that asked for one with STEP_UP_REQUIRED.
 */
export const stepUp = async (gw: GatewayClient, proof: StepUpProof): Promise<StepUpResult> => {
  try {
    await gw.request("/auth/mfa/step-up", { body: proof, csrf: true });
    log.info("step-up verified", { factor: proof.kind });
    return "ok";
  } catch (error) {
    if (error instanceof ApiError && error.code === "invalid_code") {
      log.info("step-up proof didn't match", { factor: proof.kind });
      return "wrong";
    }
    if (error instanceof ApiError && error.code === "session_revoked") {
      log.warn("step-up attempts spent; the session was ended");
      return "revoked";
    }
    throw error;
  }
};

/** Email a step-up code. "wait" means one was sent a moment ago. */
export const sendStepUpEmail = async (gw: GatewayClient): Promise<"sent" | "wait"> => {
  try {
    await gw.request("/auth/mfa/step-up/email/send", { body: {}, csrf: true });
    return "sent";
  } catch (error) {
    if (error instanceof ApiError && error.status === 429) return "wait";
    throw error;
  }
};

/** Start a passkey step-up: the WebAuthn options and the id to send back with the assertion. */
export const beginStepUpPasskey = async (
  gw: GatewayClient,
): Promise<{ options: string; webauthnSessionId: string }> => {
  const r = await gw.request<{ options?: string; webauthnSessionId?: string }>(
    "/auth/mfa/step-up/passkey/begin",
    { body: {}, csrf: true },
  );
  return { options: r.options ?? "", webauthnSessionId: r.webauthnSessionId ?? "" };
};
