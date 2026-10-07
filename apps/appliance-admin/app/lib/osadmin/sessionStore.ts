import type { Session } from "@/lib/osadmin/types";

// The signed-in session, held in memory only (an osadmin restart or a page reload signs
// everyone out anyway, since the cookie is __Host-osadmin-session, HttpOnly, and the CSRF
// token lives only in the PollSignIn/GetSession response). A plain module-level store, read
// by the transport for the CSRF header and by the session hook for the UI.

let current: null | Session = null;
const listeners = new Set<() => void>();

export const getSession = (): null | Session => current;

export const setSession = (session: null | Session): void => {
  current = session;
  for (const listener of listeners) listener();
};

export const subscribeSession = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** A session's sign-in is fresh enough for a step-up-gated action. */
export const isStepUpFresh = (session: null | Session, now: Date = new Date()): boolean =>
  !!session?.stepUpUntil && new Date(session.stepUpUntil).getTime() > now.getTime();
