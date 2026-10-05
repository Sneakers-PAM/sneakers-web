import type { Problem } from "#shell/diagnostics/report";

/**
 * The refusals this browser tab showed recently, keyed by the message a screen put up, so a
 * Copy diagnostics button on a toast or an alert can name the operation, code, reason and
 * trace behind it. Browser-only: on the server (one process, many users) nothing is kept.
 */
const KEEP_MS = 10 * 60 * 1000;
const MAX = 20;

interface Noted {
  at: number;
  problem: Problem;
}

let noted: Noted[] = [];
let route: string | undefined;

const inBrowser = (): boolean => typeof document !== "undefined";

export interface RefusalFacts {
  code?: string;
  domain?: string;
  operation?: string;
  reason?: string;
  traceId?: string;
}

/** Remember that `message` was shown for this refusal. */
export const noteProblem = (facts: RefusalFacts, message: string): void => {
  if (!inBrowser()) return;
  const problem: Problem = { message };
  for (const k of ["code", "domain", "operation", "reason", "traceId"] as const) {
    if (facts[k]) problem[k] = facts[k];
  }
  noted = [{ at: Date.now(), problem }, ...noted.filter((n) => n.problem.message !== message)];
  noted = noted.slice(0, MAX);
};

/** The refusal behind `message`, when one produced it in the last ten minutes. */
export const problemFor = (message?: string): Problem | undefined => {
  if (!message) return undefined;
  const cutoff = Date.now() - KEEP_MS;
  noted = noted.filter((n) => n.at >= cutoff);
  return noted.find((n) => n.problem.message === message)?.problem ?? { message };
};

/** The route the app is on (set by AppRoot), for reports made outside a component. */
export const setCurrentRoute = (id: string | undefined): void => {
  if (inBrowser()) route = id;
};

export const currentRoute = (): string | undefined => route;

/** For tests. */
export const resetProblems = (): void => {
  noted = [];
  route = undefined;
};
