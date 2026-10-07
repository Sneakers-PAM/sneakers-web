import type { Session } from "@/lib/osadmin/types";

// The signed-in session, held in memory only (an osadmin restart or a page reload signs
// everyone out anyway, since the cookie is __Host-osadmin-session, HttpOnly, and the CSRF
// token lives only in the SignIn/StepUp/GetSession response). A plain module-level store, read
// by the transport for the CSRF header and by the session hook for the UI.

let current: null | Session = null;
const listeners = new Set<() => void>();

// A redeemed one-time code's CSRF token (RedeemCodeResponse.csrfToken), for the code session's
// calls before a signed-in session exists. Kept in sessionStorage too, so a reload part-way
// through setup can still finish the admin's credentials; a session replaces it.
const CODE_CSRF_KEY = "osadmin_code_csrf";
let codeCsrf = globalThis.sessionStorage?.getItem(CODE_CSRF_KEY) ?? "";

export const setCodeCsrfToken = (token: string): void => {
  codeCsrf = token;
  if (token) globalThis.sessionStorage?.setItem(CODE_CSRF_KEY, token);
  else globalThis.sessionStorage?.removeItem(CODE_CSRF_KEY);
};

/** The X-CSRF-Token for a call that changes something: the session's, else the code's. */
export const csrfToken = (): string => current?.csrfToken || codeCsrf;

export const getSession = (): null | Session => current;

export const setSession = (session: null | Session): void => {
  current = session;
  setCodeCsrfToken("");
  for (const listener of listeners) listener();
};

export const subscribeSession = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** A session's sign-in is fresh enough for a step-up-gated action. */
export const isStepUpFresh = (session: null | Session, now: Date = new Date()): boolean =>
  !!session?.stepUpUntil && new Date(session.stepUpUntil).getTime() > now.getTime();
