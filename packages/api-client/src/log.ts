import { type LogLevel, runtimeConfig } from "#api/config";

const ORDER: Record<LogLevel, number> = { debug: 1, error: 4, info: 2, trace: 0, warn: 3 };

export type LogFields = Record<string, boolean | null | number | string | undefined>;

export interface Logger {
  debug(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  trace(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
}

/**
 * A small leveled logger for the browser console. The level comes from the runtime
 * config (LOG_LEVEL at deploy time), never from code. Callers pass ids and outcomes,
 * never secret values, tokens or personal data.
 */
export const createLogger = (scope: string): Logger => {
  const emit = (level: LogLevel, message: string, fields?: LogFields) => {
    if (ORDER[level] < ORDER[runtimeConfig().logLevel]) return;
    const line = { level, msg: message, scope, ...fields };
    const function_ =
      level === "error" ? console.error : level === "warn" ? console.warn : console.log;
    function_(`[${level}] ${scope}: ${message}`, line);
  };
  return {
    debug: (m, f) => emit("debug", m, f),
    error: (m, f) => emit("error", m, f),
    info: (m, f) => emit("info", m, f),
    trace: (m, f) => emit("trace", m, f),
    warn: (m, f) => emit("warn", m, f),
  };
};
