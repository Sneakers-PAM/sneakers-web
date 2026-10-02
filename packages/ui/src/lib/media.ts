import { useEffect, useState } from "react";

export type Breakpoint = "desktop" | "phone" | "tablet";

/** The Laces breakpoints: phone below 600 px, tablet below 1024 px, desktop above. */
export const useBreakpoint = (): Breakpoint => {
  const tablet = useMediaQuery("(min-width: 600px)");
  const desktop = useMediaQuery("(min-width: 1024px)");
  return desktop ? "desktop" : tablet ? "tablet" : "phone";
};

/** Track a CSS media query. */
export const useMediaQuery = (query: string): boolean => {
  const get = () => typeof matchMedia !== "undefined" && matchMedia(query).matches;
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    const mq = matchMedia(query);
    const on = () => setMatches(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return matches;
};
