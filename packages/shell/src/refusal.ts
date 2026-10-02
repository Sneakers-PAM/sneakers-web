import { GraphQLRequestError } from "@sneakers-web/api-client";

/**
 * A gateway refusal in a form a loader or action can hand to the page: the canonical code,
 * the stable reason and its metadata, and the backend's own explanation (the text after
 * "desc =", which names what was wrong for input errors).
 */
export interface Refusal {
  code?: string;
  detail: string;
  metadata: Record<string, string>;
  reason?: string;
}

/** The refusal behind an error from `gw.gql`, or null when the error is something else. */
export const refusalOf = (error: unknown): null | Refusal => {
  if (!(error instanceof GraphQLRequestError)) return null;
  const detail = /desc = ([\s\S]*)$/.exec(error.message)?.[1]?.trim() ?? error.message;
  return { code: error.code, detail, metadata: error.metadata, reason: error.reason };
};

/** Whether a refusal asks for a fresh second factor (the step-up prompt, then a retry). */
export const needsStepUp = (r: null | Refusal | undefined): boolean =>
  r?.reason === "STEP_UP_REQUIRED";

const BY_REASON: Record<string, string> = {
  API_SENSITIVE_DISABLED:
    "Tokens and service accounts can't use super-sensitive fields while API access to sensitive secrets is off.",
  CHECKOUT_LEASE_HELD: "Someone has this secret checked out. Try again after it's checked in.",
  GROUP_ID_REQUIRED: "A group rule needs the group itself. Pick the group from the list again.",
  NOT_FOLDER_OWNER: "Only an owner of this folder can do that.",
  NOT_SITE_ADMIN: "Only a site admin can do that.",
  RECOVERY_ROLE_REQUIRED:
    "Prior values need the recovery role. A site admin can grant it on your user page.",
  ROTATION_IN_PROGRESS: "The secret is being rotated. Try again when the rotation finishes.",
  STEP_UP_REQUIRED: "Confirm it's you with a fresh second factor, then try again.",
};

const BY_CODE: Record<string, string> = {
  NOT_FOUND: "That item no longer exists. It may have been deleted.",
  PERMISSION_DENIED: "You don't have permission to do that.",
  UNAVAILABLE: "A service behind the gateway isn't answering. Try again in a moment.",
  UNIMPLEMENTED: "This server doesn't support that yet.",
};

/** One plain sentence for a refusal: the reason first, then the code, then the backend's text. */
export const refusalMessage = (r: Refusal): string => {
  if (r.reason && BY_REASON[r.reason]) return BY_REASON[r.reason] as string;
  if (r.code && ["ALREADY_EXISTS", "FAILED_PRECONDITION", "INVALID_ARGUMENT"].includes(r.code)) {
    return r.detail ? r.detail.charAt(0).toUpperCase() + r.detail.slice(1) : "That didn't work.";
  }
  return (r.code && BY_CODE[r.code]) || r.detail || "That didn't work. Try again.";
};
