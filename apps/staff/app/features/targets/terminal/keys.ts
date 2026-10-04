export type Platform = "mac" | "other";

/** The page's own terminal shortcuts. Everything else (Ctrl-C included) goes to the shell. */
export type Shortcut = "bigger" | "copy" | "fullscreen" | "reconnect" | "smaller";

export const platformOf = (agent: string): Platform =>
  /Mac|iPhone|iPad/.test(agent) ? "mac" : "other";

type Keys = Pick<KeyboardEvent, "altKey" | "ctrlKey" | "key" | "metaKey" | "shiftKey">;

/**
 * The shortcut a key press means, or null. macOS uses Command; Windows and Linux use Ctrl,
 * with Shift for copy, since Ctrl-C belongs to the shell there.
 */
export const shortcutFor = (event: Keys, platform: Platform): null | Shortcut => {
  const primary = platform === "mac" ? event.metaKey : event.ctrlKey;
  if (!primary || event.altKey) return null;
  const key = event.key.toLowerCase();
  if (key === "=" || key === "+") return "bigger";
  if (key === "-" || key === "_") return "smaller";
  if (!event.shiftKey) return platform === "mac" && key === "c" ? "copy" : null;
  if (key === "c") return "copy";
  if (key === "f") return "fullscreen";
  if (key === "r") return "reconnect";
  return null;
};

const MAC = { mod: "⌘", shift: "⇧" };
const OTHER = { mod: "Ctrl", shift: "Shift" };

/** The shortcuts dialog's rows for a platform. */
export const shortcutRows = (platform: Platform): { action: string; keys: string }[] => {
  const k = platform === "mac" ? MAC : OTHER;
  const copy = platform === "mac" ? `${k.mod} C` : `${k.mod} ${k.shift} C`;
  return [
    { action: "Copy selection", keys: copy },
    { action: "Paste", keys: `${k.mod} V` },
    { action: "Bigger / smaller text", keys: `${k.mod} + / ${k.mod} −` },
    { action: "Fullscreen", keys: `${k.mod} ${k.shift} F` },
    { action: "Reconnect", keys: `${k.mod} ${k.shift} R` },
    { action: "Interrupt the running command", keys: "Ctrl C" },
    { action: "Leave terminal focus", keys: "Esc Esc" },
  ];
};
