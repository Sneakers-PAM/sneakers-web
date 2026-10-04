export type CreateScreen = (mount: HTMLElement, options: { fontSize: number }) => Promise<Screen>;

/**
 * The terminal surface the page draws into. The page talks to this interface; xterm.js sits
 * behind it, loaded only in the browser (it touches the DOM when imported).
 */
export interface Screen {
  blur: () => void;
  dispose: () => void;
  fit: () => void;
  focus: () => void;
  onInput: (handler: (data: string) => void) => void;
  /** Called for every key event first; return false to keep it from the session. */
  onKey: (handler: (event: KeyboardEvent) => boolean) => void;
  onResize: (handler: (cols: number, rows: number) => void) => void;
  /** Clear the screen and scrollback for a new session. */
  reset: () => void;
  selection: () => string;
  setFontSize: (px: number) => void;
  size: () => { cols: number; rows: number };
  write: (data: string | Uint8Array) => void;
}

// The design's terminal palette: dark in both themes, so remote colours read the same.
const THEME = {
  background: "#0E1117",
  black: "#0E1117",
  blue: "#8FA9FF",
  brightBlack: "#5A6170",
  brightBlue: "#B3C4FF",
  brightCyan: "#A4DAFF",
  brightGreen: "#9BE5BC",
  brightMagenta: "#D7B8FF",
  brightRed: "#FFA99F",
  brightWhite: "#FFFFFF",
  brightYellow: "#FFD98A",
  cursor: "#FF9A55",
  cursorAccent: "#0E1117",
  cyan: "#7DCFFF",
  foreground: "#E6E9EF",
  green: "#6FD39B",
  magenta: "#C7A9FF",
  red: "#FF8577",
  selectionBackground: "#2A3550",
  white: "#C9CED8",
  yellow: "#F2C55C",
};

export const createXtermScreen: CreateScreen = async (mount, { fontSize }) => {
  const [{ Terminal }, { FitAddon }] = await Promise.all([
    import("@xterm/xterm"),
    import("@xterm/addon-fit"),
  ]);
  const term = new Terminal({
    cursorBlink: true,
    fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize,
    lineHeight: 1.25,
    scrollback: 5000,
    theme: THEME,
  });
  const fit = new FitAddon();
  term.loadAddon(fit);
  term.open(mount);
  fit.fit();
  const observer = new ResizeObserver(() => fit.fit());
  observer.observe(mount);
  return {
    blur: () => term.blur(),
    dispose: () => {
      observer.disconnect();
      term.dispose();
    },
    fit: () => fit.fit(),
    focus: () => term.focus(),
    onInput: (handler) => void term.onData(handler),
    onKey: (handler) => term.attachCustomKeyEventHandler(handler),
    onResize: (handler) => void term.onResize(({ cols, rows }) => handler(cols, rows)),
    reset: () => term.reset(),
    selection: () => term.getSelection(),
    setFontSize: (px) => {
      term.options.fontSize = px;
      fit.fit();
    },
    size: () => ({ cols: term.cols, rows: term.rows }),
    write: (data) => term.write(data),
  };
};
