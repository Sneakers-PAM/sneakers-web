// A single step-up dialog mounted once (in the frame) serves every mutating action: a call
// that answers ACCESS_STEPUP_REQUIRED queues its own retry here instead of each page building
// its own prompt.

type Listener = () => void;

let pending: (() => void) | null = null;
const listeners = new Set<Listener>();

const notify = (): void => {
  for (const listener of listeners) listener();
};

export const requestStepUp = (retry: () => void): void => {
  pending = retry;
  notify();
};

export const stepUpPending = (): boolean => pending !== null;

export const subscribeStepUp = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const cancelStepUp = (): void => {
  pending = null;
  notify();
};

export const resumeStepUp = (): void => {
  const retry = pending;
  pending = null;
  notify();
  retry?.();
};
