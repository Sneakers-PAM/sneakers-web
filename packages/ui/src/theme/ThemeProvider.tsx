import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type ContrastChoice = "high" | "standard";
export interface DisplaySettings {
  contrast: ContrastChoice;
  motion: MotionChoice;
  textScale: TextScale;
  theme: ThemeChoice;
}
export type MotionChoice = "reduce" | "system";
export type TextScale = 1 | 1.25 | 1.5 | 2;

export type ThemeChoice = "dark" | "light" | "system";

export const DEFAULT_DISPLAY: DisplaySettings = {
  contrast: "standard",
  motion: "system",
  textScale: 1,
  theme: "system",
};

interface DisplayContext {
  settings: DisplaySettings;
  update: (patch: Partial<DisplaySettings>) => void;
}

const Ctx = createContext<DisplayContext>({ settings: DEFAULT_DISPLAY, update: () => {} });

const THEMES: Set<ThemeChoice> = new Set(["dark", "light", "system"]);
const SCALES: Set<TextScale> = new Set([1, 1.25, 1.5, 2]);

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
  root.style.setProperty("--text-scale", String(s.textScale));
};

/** Read saved settings, ignoring anything malformed (the value comes from browser storage). */
export const parseDisplay = (raw: null | string): DisplaySettings => {
  if (!raw) return DEFAULT_DISPLAY;
  try {
    const v = JSON.parse(raw) as Partial<DisplaySettings>;
    return {
      contrast: v.contrast === "high" ? "high" : "standard",
      motion: v.motion === "reduce" ? "reduce" : "system",
      textScale: SCALES.has(v.textScale as TextScale) ? (v.textScale as TextScale) : 1,
      theme: THEMES.has(v.theme as ThemeChoice) ? (v.theme as ThemeChoice) : "system",
    };
  } catch {
    return DEFAULT_DISPLAY;
  }
};

/**
 * Theme, contrast, motion and text size, saved to this browser under `storageKey`.
 * "System" follows the device setting.
 */
export const ThemeProvider = ({
  children,
  storageKey,
}: {
  children: ReactNode;
  storageKey: string;
}) => {
  const [settings, setSettings] = useState<DisplaySettings>(() =>
    parseDisplay(typeof localStorage === "undefined" ? null : localStorage.getItem(storageKey)),
  );
  useEffect(() => {
    applyDisplay(settings);
    localStorage.setItem(storageKey, JSON.stringify(settings));
  }, [settings, storageKey]);
  const update = useCallback(
    (patch: Partial<DisplaySettings>) => setSettings((s) => ({ ...s, ...patch })),
    [],
  );
  const value = useMemo(() => ({ settings, update }), [settings, update]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useDisplay = (): DisplayContext => {
  return useContext(Ctx);
};
