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

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

interface ExpiringEntry<T> {
  expires: number;
  value: T;
}

/** Write `value` to local storage so it reads back as missing once `ttlMs` has passed. */
export const writeExpiringItem = <T>(key: string, value: T, ttlMs = THIRTY_DAYS_MS): void => {
  try {
    const entry: ExpiringEntry<T> = { expires: Date.now() + ttlMs, value };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // storage unavailable (private mode, quota, no window) -- the setting just doesn't persist
  }
};

/** Read a value written by `writeExpiringItem`; null if missing, expired or malformed. */
export const readExpiringItem = <T>(key: string): null | T => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as Partial<ExpiringEntry<T>>;
    if (typeof entry.expires !== "number" || entry.expires < Date.now()) return null;
    return entry.value ?? null;
  } catch {
    return null;
  }
};

/**
 * A value written by `writeExpiringItem`, as a hook: null on the server, before hydration, or
 * once it has expired. `version` lets a caller re-read right after it writes the key itself.
 */
export const useExpiringLocalValue = <T>(key: string, version = 0): null | T =>
  useSyncExternalStore(
    subscribe,
    () => (version >= 0 ? readExpiringItem<T>(key) : null),
    () => null,
  );
