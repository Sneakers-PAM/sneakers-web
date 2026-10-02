/** True when the OS asks for reduced motion or the user picked "Reduce" in the display panel. */
export const prefersReducedMotion = (): boolean => {
  if (
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("reduce-motion")
  ) {
    return true;
  }
  return (
    typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches
  );
};
