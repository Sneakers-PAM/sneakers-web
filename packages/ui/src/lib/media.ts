import { useCallback, useSyncExternalStore } from "react";

export type Breakpoint = "desktop" | "phone" | "tablet";

/** The Laces breakpoints: phone below 600 px, tablet below 1024 px, desktop above. */
export const useBreakpoint = (): Breakpoint => {
  const tablet = useMediaQuery("(min-width: 600px)");
  const desktop = useMediaQuery("(min-width: 1024px)");
  return desktop ? "desktop" : tablet ? "tablet" : "phone";
};

/**
 * True at real desktop width: wide enough for a fixed sidebar rail and every header action at
 * once (1440 px). An iPad Pro 13 (1024 or 1366 wide) still reads as "desktop" from
 * `useBreakpoint`, but has no room for either.
 */
export const useWideDesktop = (): boolean => useMediaQuery("(min-width: 1440px)");

/**
 * Track a CSS media query. The server has no screen, so it answers false; hydration uses that
 * same answer and switches to the real one straight after, so the markup always matches.
 */
export const useMediaQuery = (query: string): boolean => {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mq = matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => matchMedia(query).matches,
    () => false,
  );
};
