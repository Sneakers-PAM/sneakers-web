import {
  AgentsDecideUsesDocument,
  AgentsUseRunDocument,
  ApiError,
  beginStepUpPasskey,
  createLogger,
  type GatewayClient,
  type SecretUseRefusal,
  sendStepUpEmail,
  stepUp,
  type StepUpProof,
} from "@sneakers-web/api-client";
import { refusalOf } from "@sneakers-web/shell";
import { appPath, guard, relayCookies, requireUser } from "@sneakers-web/shell/server";
import { redirect } from "react-router";

const log = createLogger("agent-run");

export interface RunData {
  /** When the session's factor stops covering an approval (ms), or 0 when it doesn't now. */
  freshUntil: number;
  runId: string;
  user: { email: string; name: string };
  uses: RunUse[];
}

export interface RunOutcome {
  decided: boolean;
  id: string;
  reason: null | SecretUseRefusal;
}

/**
 * `code`: the factor didn't check out; `step-up`: the session's window is closed, so the
 * factor is needed; `batch`: nothing (or too much) was ticked; `passkey` and `unavailable`
 * as at step-up.
 */
export type RunProblem = "batch" | "code" | "passkey" | "step-up" | "unavailable";

/** What a post on the run page answers. */
export type RunResult =
  | { decision: "approve" | "deny"; outcomes: RunOutcome[]; view: "decided" }
  | { emailState: "sent" | "wait"; view: "prompt" }
  | { passkey: { options: string; webauthnSessionId: string }; view: "prompt" }
  | { problem: RunProblem; view: "prompt" };

/** One pending use on the run page. */
export interface RunUse {
  clientLabel: string;
  /** The exact command, or "" for a reveal to the agent itself. */
  command: string;
  /** ms */
  expiresAt: number;
  fieldKey: string;
  id: string;
  /** The agent's own words for its task. Plain text, never trusted. */
  purpose: string;
  requester: string;
  reveal: boolean;
  secretName: string;
}

const field = (form: FormData, key: string): string => String(form.get(key) ?? "").trim();

/** U-14b: every pending use one agent run raised, for one decision. */
export const loadRun = async (request: Request, runId: string): Promise<RunData> => {
  const { gw, user } = await requireUser(request);
  log.debug("run load", { runId });
  return guard(request, async () => {
    const { secretUseRun: run } = await gw.gql(AgentsUseRunDocument, { runId });
    const uses = run.uses
      .map((u) => ({
        clientLabel: u.clientLabel,
        command: u.reveal ? "" : u.argv.join(" "),
        expiresAt: u.expiresAtUnix * 1000,
        fieldKey: u.fieldKey,
        id: u.id,
        purpose: u.purpose,
        requester: u.requester || u.clientLabel,
        reveal: u.reveal,
        secretName: u.secretName,
      }))
      .toSorted((a, b) => a.expiresAt - b.expiresAt);
    log.debug("run loaded", { count: uses.length, fresh: run.mfaFreshUntilUnix > 0, runId });
    return {
      freshUntil: run.mfaFreshUntilUnix * 1000,
      runId,
      user: { email: user.email, name: user.name },
      uses,
    };
  });
};

/** The factor a form carries, if any: a code (totp or email) or a passkey assertion. */
const proofFrom = (form: FormData): null | StepUpProof => {
  const kind = field(form, "factor");
  if (kind === "passkey") {
    const credentialJson = String(form.get("credentialJson") ?? "");
    const webauthnSessionId = field(form, "webauthnSessionId");
    return credentialJson && webauthnSessionId ? { credentialJson, kind, webauthnSessionId } : null;
  }
  if (kind !== "totp" && kind !== "email") return null;
  return { code: field(form, "code").replaceAll(/\D/g, ""), kind };
};

const decide = async (
  gw: GatewayClient,
  runId: string,
  ids: string[],
  decision: "approve" | "deny",
): Promise<RunResult> => {
  try {
    const { decideSecretUses } = await gw.gql(AgentsDecideUsesDocument, {
      decision: decision === "approve" ? "APPROVE" : "DENY",
      ids,
    });
    const outcomes = decideSecretUses.outcomes.map((o) => ({
      decided: o.decided,
      id: o.id,
      reason: o.reason,
    }));
    const refused = outcomes.filter((o) => !o.decided);
    log.info("run decided", {
      decided: outcomes.length - refused.length,
      decision,
      reasons: refused.map((o) => o.reason).join(","),
      refused: refused.length,
      runId,
    });
    return { decision, outcomes, view: "decided" };
  } catch (error) {
    const refusal = refusalOf(error);
    if (refusal?.reason === "STEP_UP_REQUIRED") {
      log.info("run approval needs the factor", { runId });
      return { problem: "step-up", view: "prompt" };
    }
    if (refusal?.reason === "BATCH_SIZE_INVALID") {
      log.warn("run batch refused for its size", { count: ids.length, runId });
      return { problem: "batch", view: "prompt" };
    }
    if (refusal) {
      log.warn("run decision refused", { code: refusal.code, reason: refusal.reason, runId });
      return { problem: "unavailable", view: "prompt" };
    }
    throw error;
  }
};

/**
 * `approve` and `deny` the ticked `ids` (comma-separated), plus `factor-email` and
 * `factor-passkey`. An approval with a factor proves it through the session step-up first,
 * which also opens the MFA_MAX_AGE window for a follow-up batch; then the batch is
 * decided without a factor of its own.
 */
export const runAction = async (request: Request, runId: string): Promise<RunResult> => {
  const { gw } = await requireUser(request);
  const form = await request.formData();
  const intent = field(form, "intent");
  log.debug("run step", { intent, runId });
  return guard(request, async () => {
    try {
      if (intent === "factor-email") {
        return { emailState: await sendStepUpEmail(gw), view: "prompt" as const };
      }
      if (intent === "factor-passkey") {
        return { passkey: await beginStepUpPasskey(gw), view: "prompt" as const };
      }
      if (intent !== "approve" && intent !== "deny") {
        log.warn("unknown intent", { intent });
        throw new Response("Unknown intent", { status: 400 });
      }
      const ids = field(form, "ids")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (ids.length === 0) return { problem: "batch" as const, view: "prompt" as const };
      const proof = intent === "approve" ? proofFrom(form) : null;
      if (proof) {
        if (proof.kind !== "passkey" && proof.code.length !== 6)
          return { problem: "code" as const, view: "prompt" as const };
        const result = await stepUp(gw, proof);
        if (result === "revoked") {
          throw redirect(`${appPath("sign-in")}?ended=1`, { headers: relayCookies(gw) });
        }
        if (result === "wrong") {
          return {
            problem: proof.kind === "passkey" ? ("passkey" as const) : ("code" as const),
            view: "prompt" as const,
          };
        }
      }
      return await decide(gw, runId, ids, intent);
    } catch (error) {
      if (error instanceof Response) throw error;
      if (error instanceof ApiError && error.status !== 401) {
        log.warn("run step failed", { code: error.code, intent, runId, status: error.status });
        return {
          problem: intent === "factor-passkey" ? ("passkey" as const) : ("unavailable" as const),
          view: "prompt" as const,
        };
      }
      throw error;
    }
  });
};
