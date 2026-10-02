import {
  ApiError,
  beginStepUpPasskey,
  createLogger,
  sendStepUpEmail,
  stepUp,
  type StepUpProof,
} from "@sneakers-web/api-client";
import { type ActionFunctionArgs, data, redirect } from "react-router";

import { relayCookies } from "#shell/server/gateway.server";
import { appPath } from "#shell/server/paths.server";
import { requireUser } from "#shell/server/session.server";

const log = createLogger("step-up");

/** What the step-up prompt shows after each post. The prompt keeps its own factor choice. */
export type StepUpState =
  | { emailState: "sent" | "wait"; view: "prompt" }
  | { passkey: { options: string; webauthnSessionId: string }; view: "prompt" }
  | { problem: "passkey" | "unavailable"; view: "prompt" }
  | { verifiedAt: number; view: "verified" }
  | { view: "prompt"; wrong: true };

const field = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

/**
 * The step-up prompt's resource action: email a code, start a passkey, or check a proof.
 * After "verified" the page retries the call that answered STEP_UP_REQUIRED. Too many
 * wrong proofs end the session, so that answer is a redirect to sign-in.
 */
export const stepUpAction = async ({ request }: ActionFunctionArgs) => {
  const { gw } = await requireUser(request);
  const form = await request.formData();
  const intent = field(form, "intent");
  log.debug("step-up step", { intent });
  try {
    if (intent === "email") {
      return data<StepUpState>({ emailState: await sendStepUpEmail(gw), view: "prompt" });
    }
    if (intent === "passkey-begin") {
      return data<StepUpState>({ passkey: await beginStepUpPasskey(gw), view: "prompt" });
    }
    if (intent === "verify") {
      const kind = field(form, "kind");
      let proof: StepUpProof;
      if (kind === "passkey") {
        proof = {
          credentialJson: String(form.get("credentialJson") ?? ""),
          kind,
          webauthnSessionId: field(form, "webauthnSessionId"),
        };
        if (!proof.credentialJson || !proof.webauthnSessionId)
          return data<StepUpState>({ problem: "passkey", view: "prompt" });
      } else {
        const code = field(form, "code").replaceAll(/\D/g, "");
        if (code.length !== 6) return data<StepUpState>({ view: "prompt", wrong: true });
        proof = { code, kind: kind === "email" ? "email" : "totp" };
      }
      const result = await stepUp(gw, proof);
      if (result === "revoked") {
        throw redirect(`${appPath("sign-in")}?ended=1`, { headers: relayCookies(gw) });
      }
      if (result === "wrong") return data<StepUpState>({ view: "prompt", wrong: true });
      return data<StepUpState>({ verifiedAt: Date.now(), view: "verified" });
    }
  } catch (error) {
    if (error instanceof Response) throw error;
    log.warn("step-up step failed", {
      code: error instanceof ApiError ? error.code : undefined,
      intent,
    });
    return data<StepUpState>({
      problem: intent === "passkey-begin" ? "passkey" : "unavailable",
      view: "prompt",
    });
  }
  return data<StepUpState>({ problem: "unavailable", view: "prompt" }, { status: 400 });
};
