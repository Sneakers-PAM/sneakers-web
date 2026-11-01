import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";

export type ContrastChoice = "high" | "standard";
export interface DisplaySettings {
  contrast: ContrastChoice;
  motion: MotionChoice;
  textScale: TextScale;
  theme: ThemeChoice;
}
export type MotionChoice = "reduce" | "system";
export type TextScale = "large" | "normal" | "small" | "x-large" | "x-small";

export type ThemeChoice = "dark" | "light" | "system";

export const DEFAULT_DISPLAY: DisplaySettings = {
  contrast: "standard",
  motion: "system",
  textScale: "normal",
  theme: "system",
};

/** The text sizes, smallest first. `factor` multiplies the root size, and normal leaves it alone. */
export const TEXT_SIZES: { factor: number; label: string; value: TextScale }[] = [
  { factor: 0.85, label: "X-small", value: "x-small" },
  { factor: 0.925, label: "Small", value: "small" },
  { factor: 1, label: "Normal", value: "normal" },
  { factor: 1.15, label: "Large", value: "large" },
  { factor: 1.3, label: "X-large", value: "x-large" },
];

/** What `--text-scale` holds for a text size. */
export const textScaleFactor = (scale: TextScale): number =>
  TEXT_SIZES.find((s) => s.value === scale)?.factor ?? 1;

interface DisplayState {
  settings: DisplaySettings;
  update: (patch: Partial<DisplaySettings>) => void;
}

const DisplayContext = createContext<DisplayState>({ settings: DEFAULT_DISPLAY, update: () => {} });

const THEMES: Set<ThemeChoice> = new Set(["dark", "light", "system"]);
/** The percentages saved before the steps had names. */
const OLD_SCALES = new Map<unknown, TextScale>([
  [1, "normal"],
  [1.25, "large"],
  [1.5, "x-large"],
  [2, "x-large"],
]);

const parseTextScale = (saved: unknown): TextScale =>
  OLD_SCALES.get(saved) ??
  TEXT_SIZES.find((s) => s.value === saved)?.value ??
  DEFAULT_DISPLAY.textScale;

/** The <html> classes for the settings, so the server renders the right theme on first paint. */
export const displayClassName = (s: DisplaySettings): string =>
  [
    s.contrast === "high"
      ? "hc"
      : s.theme === "dark"
        ? "dark"
        : s.theme === "system"
          ? "system"
          : "",
    s.motion === "reduce" ? "reduce-motion" : "",
  ]
    .filter(Boolean)
    .join(" ");

/** Apply the settings as classes and a text-scale variable on <html>. */
export const applyDisplay = (
  s: DisplaySettings,
  root: HTMLElement = document.documentElement,
): void => {
  root.classList.remove("dark", "system", "hc", "reduce-motion");
  if (s.contrast === "high") root.classList.add("hc");
  else if (s.theme === "dark") root.classList.add("dark");
  else if (s.theme === "system") root.classList.add("system");
  if (s.motion === "reduce") root.classList.add("reduce-motion");
  root.style.setProperty("--text-scale", String(textScaleFactor(s.textScale)));
};

/** Read saved settings, ignoring anything malformed (the value comes from a cookie). */
export const parseDisplay = (raw: null | string): DisplaySettings => {
  if (!raw) return DEFAULT_DISPLAY;
  try {
    const v = JSON.parse(raw) as Partial<DisplaySettings>;
    return {
      contrast: v.contrast === "high" ? "high" : "standard",
      motion: v.motion === "reduce" ? "reduce" : "system",
      textScale: parseTextScale(v.textScale),
      theme: THEMES.has(v.theme as ThemeChoice) ? (v.theme as ThemeChoice) : "system",
    };
  } catch {
    return DEFAULT_DISPLAY;
  }
};

/**
 * Theme, contrast, motion and text size. The server reads the saved choice from a cookie,
 * so the first paint is already right; a change applies at once and `onChange` saves it.
 * "System" follows the device setting.
 */
export const ThemeProvider = ({
  children,
  initial,
  onChange,
}: {
  children: ReactNode;
  initial: DisplaySettings;
  onChange?: (settings: DisplaySettings) => void;
}) => {
  const [settings, setSettings] = useState<DisplaySettings>(initial);
  const update = useCallback(
    (patch: Partial<DisplaySettings>) => {
      setSettings((s) => {
        const next = { ...s, ...patch };
        applyDisplay(next);
        onChange?.(next);
        return next;
      });
    },
    [onChange],
  );
  const value = useMemo(() => ({ settings, update }), [settings, update]);
  return <DisplayContext.Provider value={value}>{children}</DisplayContext.Provider>;
};

export const useDisplay = (): DisplayState => {
  return useContext(DisplayContext);
};
