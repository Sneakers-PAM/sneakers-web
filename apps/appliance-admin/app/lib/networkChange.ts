// The Network page tells the frame's pending-change banner to read the box again after an
// Apply or a Confirm, so the banner never lags the page that changed it.

type Listener = () => void;

const listeners = new Set<Listener>();

export const networkChanged = (): void => {
  for (const listener of listeners) listener();
};

export const subscribeNetworkChange = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
