import { useSyncExternalStore } from "react";

const unsubscribe = () => {};
const subscribe = () => unsubscribe;

/** False while the server renders and during hydration, true once the page runs in a browser. */
export const useIsClient = (): boolean =>
  useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

/**
 * A value read from session storage, as a hook: null on the server and before hydration.
 * `version` lets a caller re-read after it writes the key itself.
 */
export const useSessionValue = (key: string, version = 0): null | string =>
  useSyncExternalStore(
    subscribe,
    () => (version >= 0 ? sessionStorage.getItem(key) : null),
    () => null,
  );
