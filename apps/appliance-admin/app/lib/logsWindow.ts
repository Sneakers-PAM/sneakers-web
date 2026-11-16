/** The spans the Logs page offers; the box takes exactly these names for `window`. */
export const LOG_PRESETS = ["15m", "1h", "6h", "24h"] as const;

export type LogPreset = (typeof LOG_PRESETS)[number];

/**
 * What to download: the span ending now, or both ends of a custom range as RFC 3339 UTC. There
 * is no open-ended window.
 */
export type LogsWindow = { from: string; to: string } | { preset: LogPreset };

/** A window the box would refuse, caught on the page before anything is sent. */
export class LogsWindowError extends Error {}

const MAX_SPAN_MS = 7 * 24 * 3_600_000;

/** RFC 3339 UTC to the second, the form the box reads. */
const utc = (ms: number) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");

/** The query string for GET /export/logs, or a LogsWindowError saying why not. */
export const logsQuery = (window: LogsWindow): string => {
  if ("preset" in window) return new URLSearchParams({ window: window.preset }).toString();
  const from = Date.parse(window.from);
  const to = Date.parse(window.to);
  if (Number.isNaN(from) || Number.isNaN(to))
    throw new LogsWindowError("Choose both a start and an end.");
  if (to <= from) throw new LogsWindowError("The end must be after the start.");
  if (to - from > MAX_SPAN_MS) throw new LogsWindowError("The range can be at most 7 days.");
  return new URLSearchParams({ from: utc(from), to: utc(to) }).toString();
};
