// How the restart page tells the box went away and came back. The public GetPhase answers
// without a session, so no answer from it means the box is down. Sessions live in osadmin's
// memory and never survive a restart: a box that answers GetSession without the session this
// tab had has restarted, while one that still has it hasn't started the reboot yet.
import type { GetPhaseResponse } from "@/lib/osadmin/types";

import { signIn, status } from "@/lib/osadmin/client";
import { OsadminError } from "@/lib/osadmin/errors";

/** What a probe of :8443 learned: still up on this session, signed out (it restarted), or down. */
export type BoxAnswer = "down" | "session" | "signed-out";

/** Connect codes osadmin itself answers with; anything else (a proxy page, no answer) is down. */
const SIGNED_OUT = new Set(["permission_denied", "unauthenticated"]);

/** onPhase gets the public phase's answer, with an update's steps when one is under way. */
export const boxAnswer = async (
  onPhase?: (phase: GetPhaseResponse) => void,
): Promise<BoxAnswer> => {
  try {
    const phase = await status.getPhase();
    onPhase?.(phase);
  } catch {
    return "down";
  }
  try {
    const { session } = await signIn.getSession();
    return session ? "session" : "signed-out";
  } catch (error) {
    if (error instanceof OsadminError && SIGNED_OUT.has(error.code)) return "signed-out";
    return "down";
  }
};

/**
 * A full page load of the sign-in page: the browser opens a new TLS session, so a certificate
 * the box made while it restarted is checked (and, if it changed, the browser says so) instead of
 * the page going dead.
 */
export const goToSignIn = (): void => {
  window.location.assign("/");
};
