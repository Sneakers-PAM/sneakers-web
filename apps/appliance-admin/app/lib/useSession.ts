import { useSyncExternalStore } from "react";

import { getSession, isStepUpFresh, subscribeSession } from "@/lib/osadmin/sessionStore";
import type { Session } from "@/lib/osadmin/types";

export interface SessionInfo {
  isOwner: boolean;
  session: null | Session;
  stepUpFresh: boolean;
}

/** The signed-in session, reactive to sign-in, step-up and sign-out. */
export const useSession = (): SessionInfo => {
  const session = useSyncExternalStore(subscribeSession, getSession);
  return {
    isOwner: session?.role === "ROLE_OWNER",
    session,
    stepUpFresh: isStepUpFresh(session),
  };
};
