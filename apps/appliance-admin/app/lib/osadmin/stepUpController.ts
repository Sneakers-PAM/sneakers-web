// A single step-up dialog mounted once (in the frame) serves every mutating action: a call
// that answers ACCESS_STEPUP_REQUIRED queues its own retry here instead of each page building
// its own prompt. A retry may hand back a follow-up question, which the same dialog asks next
// (a network change's "Keep this change?"), so the admin never has to find a second button.

/** A question the dialog asks after the retried action went through. */
export interface StepUpFollowUp {
  /** One or two sentences under the title. */
  body: string;
  /** The button that does it, such as "Keep this change". */
  confirmLabel: string;
  /** The button that leaves it, such as "Not now". */
  dismissLabel: string;
  /** Runs on the confirm button; a refusal stays in the dialog. */
  run: () => Promise<void>;
  title: string;
}

type Listener = () => void;
type Retry = () => Promise<StepUpFollowUp | undefined> | void;

let pending: null | Retry = null;
let followUp: null | StepUpFollowUp = null;
const listeners = new Set<Listener>();

const notify = (): void => {
  for (const listener of listeners) listener();
};

export const requestStepUp = (retry: Retry): void => {
  pending = retry;
  followUp = null;
  notify();
};

/** The dialog is open: a code is wanted, or a follow-up waits for an answer. */
export const stepUpPending = (): boolean => pending !== null || followUp !== null;

/** The follow-up the dialog asks now, if any. */
export const stepUpFollowUp = (): null | StepUpFollowUp => followUp;

export const subscribeStepUp = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const cancelStepUp = (): void => {
  pending = null;
  followUp = null;
  notify();
};

/**
 * Runs the queued retry once the box took the code. The dialog stays open while it runs, so a
 * follow-up it returns is asked in the same dialog; without one the dialog closes.
 */
export const resumeStepUp = async (): Promise<void> => {
  const retry = pending;
  if (!retry) return;
  const next = await retry();
  // A retry refused again has queued its own step-up; leave that one be.
  if (pending !== retry) return;
  pending = null;
  followUp = next ?? null;
  notify();
};
