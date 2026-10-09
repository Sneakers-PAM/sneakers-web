// The version of the :8443 pages the box serves, from the X-Sneakers-Web-Version header every
// API answer carries. When a Base Web update swaps the pages under an open browser, the header
// names another version than this page was built as, and the frame offers a reload.
import { useSyncExternalStore } from "react";

/** The header osadmin's front sends on every API answer. */
export const WEB_VERSION_HEADER = "X-Sneakers-Web-Version";

let served = "";
const listeners = new Set<() => void>();

/** Records the version an answer named; an empty one is ignored. */
export const noteServedWebVersion = (version: null | string | undefined): void => {
  if (!version || version === served) return;
  served = version;
  for (const listener of listeners) listener();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** The served version, or "" before an answer named one. */
export const useServedWebVersion = (): string =>
  useSyncExternalStore(
    subscribe,
    () => served,
    () => "",
  );

/** For tests: forget the served version. */
export const resetServedWebVersion = (): void => {
  served = "";
  for (const listener of listeners) listener();
};
