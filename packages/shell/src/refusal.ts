import { GraphQLRequestError } from "@sneakers-web/api-client";

import { noteProblem } from "#shell/diagnostics/problems";

/**
 * A gateway refusal in a form a loader or action can hand to the page: the canonical code,
 * the stable reason and its metadata, and the backend's own explanation (the text after
 * "desc =", which names what was wrong for input errors).
 */
export interface Refusal {
  code?: string;
  detail: string;
  /** The reason's domain (sneakers.vault), for Copy diagnostics. */
  domain?: string;
  metadata: Record<string, string>;
  /** The GraphQL operation that was refused, for Copy diagnostics. */
  operation?: string;
  reason?: string;
  /** The gateway request's trace id, for Copy diagnostics. */
  traceId?: string;
}

/** The refusal behind an error from `gw.gql`, or null when the error is something else. */
export const refusalOf = (error: unknown): null | Refusal => {
  if (!(error instanceof GraphQLRequestError)) return null;
  const detail = /desc = ([\s\S]*)$/.exec(error.message)?.[1]?.trim() ?? error.message;
  return {
    code: error.code,
    detail,
    domain: error.domain,
    metadata: error.metadata,
    operation: error.operation,
    reason: error.reason,
    traceId: error.traceId,
  };
};

/** Whether a refusal asks for a fresh second factor (the step-up prompt, then a retry). */
export const needsStepUp = (r: null | Refusal | undefined): boolean =>
  r?.reason === "STEP_UP_REQUIRED";

const BY_REASON: Record<string, string> = {
  API_SENSITIVE_DISABLED:
    "Tokens and service accounts can't use highly sensitive fields while API access to sensitive secrets is off.",
  BREAK_GLASS_CODE_INVALID:
    "That code didn't work. Enter the current code from your authenticator.",
  BREAK_GLASS_NOT_ADMIN: "Only a site admin can break glass.",
  BREAK_GLASS_SESSION_CLOSED: "Your break-glass session has ended. Open a new one to carry on.",
  BREAK_GLASS_WEB_ONLY: "Break-glass is only available in the web app.",
  CHECKIN_NOT_HOLDER: "Only the person who checked it out can check it in.",
  CHECKOUT_LEASE_HELD: "Someone has this secret checked out. Try again after it's checked in.",
  CHECKOUT_NO_ACCESS: "You can't check this secret out. Ask for access first.",
  CHECKOUT_TYPE_DISABLED: "This kind of secret can't be checked out.",
  GROUP_ID_REQUIRED: "A group rule needs the group itself. Pick the group from the list again.",
  MFA_LAST_FACTOR:
    "Your administrator requires a second factor. Add another one before removing this one.",
  NOT_APPROVER: "Only an approver for this secret can decide this request.",
  NOT_FOLDER_OWNER: "Only an owner of this folder can do that.",
  NOT_SITE_ADMIN: "Only a site admin can do that.",
  RECOVERY_ROLE_REQUIRED:
    "Prior values need the recovery role. A site admin can grant it on your user page.",
  ROTATION_IN_PROGRESS: "The secret is being rotated. Try again when the rotation finishes.",
  SELF_APPROVAL: "You can't decide your own request. Another approver has to.",
  STEP_UP_REQUIRED: "Confirm it's you with a fresh second factor, then try again.",
};

const BY_CODE: Record<string, string> = {
  NOT_FOUND: "That item no longer exists. It may have been deleted.",
  PERMISSION_DENIED: "You don't have permission to do that.",
  UNAVAILABLE: "A service behind the gateway isn't answering. Try again in a moment.",
  UNIMPLEMENTED: "This server doesn't support that yet.",
};

const sentence = (r: Refusal): string => {
  if (r.reason && BY_REASON[r.reason]) return BY_REASON[r.reason] as string;
  if (r.code && ["ALREADY_EXISTS", "FAILED_PRECONDITION", "INVALID_ARGUMENT"].includes(r.code)) {
    return r.detail ? r.detail.charAt(0).toUpperCase() + r.detail.slice(1) : "That didn't work.";
  }
  return (r.code && BY_CODE[r.code]) || r.detail || "That didn't work. Try again.";
};

/**
 * One plain sentence for a refusal: the reason first, then the code, then the backend's text.
 * In the browser it also remembers which refusal the sentence stood for, so the Copy
 * diagnostics button on the toast or alert that shows it can name the operation and trace.
 */
export const refusalMessage = (r: Refusal): string => {
  const message = sentence(r);
  noteProblem(r, message);
  return message;
};
