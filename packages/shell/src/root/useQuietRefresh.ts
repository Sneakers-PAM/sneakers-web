import { useEffect } from "react";
import { useRevalidator } from "react-router";

/**
 * Re-run the page's loaders every `ms` while the tab is visible, so live screens stay
 * current without a full reload.
 */
export const useQuietRefresh = (ms: number): void => {
  const { revalidate, state } = useRevalidator();
  useEffect(() => {
    const iv = setInterval(() => {
      if (document.visibilityState === "visible" && state === "idle") void revalidate();
    }, ms);
    return () => clearInterval(iv);
  }, [ms, revalidate, state]);
};
