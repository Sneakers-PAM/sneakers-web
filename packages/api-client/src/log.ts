import type { LogLevel } from "#api/config";

const ORDER: Record<LogLevel, number> = { debug: 1, error: 4, info: 2, trace: 0, warn: 3 };

export type LogFields = Record<string, boolean | null | number | string | undefined>;

export interface Logger {
  debug(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  trace(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
}

const environment = (): Record<string, string | undefined> =>
  typeof process === "undefined" ? {} : process.env;

let level: LogLevel = (environment().LOG_LEVEL as LogLevel | undefined) ?? "error";
let json = environment().LOG_FORMAT !== "console";

/** Set the level (the browser gets it from the server's settings; the server reads LOG_LEVEL). */
export const setLogLevel = (next: LogLevel): void => {
  if (next in ORDER) level = next;
};

/** "json" (clusters) or "console" (local work). The server reads LOG_FORMAT. */
export const setLogFormat = (format: "console" | "json"): void => {
  json = format === "json";
};

/**
 * A small leveled logger. On the server it writes one JSON line per entry (or readable
 * lines with LOG_FORMAT=console); in the browser it writes to the console. Callers pass
 * ids and outcomes, never secret values, tokens or personal data.
 */
export const createLogger = (scope: string): Logger => {
  const emit = (at: LogLevel, message: string, fields?: LogFields) => {
    if (ORDER[at] < ORDER[level]) return;
    const sink = at === "error" ? console.error : at === "warn" ? console.warn : console.log;
    if (globalThis.window === undefined && json) {
      sink(
        JSON.stringify({ level: at, message, scope, time: new Date().toISOString(), ...fields }),
      );
      return;
    }
    sink(`[${at}] ${scope}: ${message}`, fields ?? "");
  };
  return {
    debug: (m, f) => emit("debug", m, f),
    error: (m, f) => emit("error", m, f),
    info: (m, f) => emit("info", m, f),
    trace: (m, f) => emit("trace", m, f),
    warn: (m, f) => emit("warn", m, f),
  };
};
