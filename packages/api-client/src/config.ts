export type AppEnv = "dev" | "prod" | "qa";
export type LogLevel = "debug" | "error" | "info" | "trace" | "warn";

/** Settings the server writes into /config.js at deploy time (window.__APP_CONFIG__). */
export interface RuntimeConfig {
  /** Where the admin console lives, for the staff app's "Admin console" link. */
  adminUrl: string;
  appEnv: AppEnv;
  logLevel: LogLevel;
  /** Offer "Sign in with SSO" first. Off when the install has no SAML provider. */
  sso: boolean;
  /** Where the staff app lives, for the admin console's "User app" link. */
  staffUrl: string;
}

declare global {
  interface Window {
    __APP_CONFIG__?: Partial<Record<keyof RuntimeConfig, unknown>>;
  }
}

const ENVS: Set<AppEnv> = new Set(["dev", "prod", "qa"]);
const LEVELS: Set<LogLevel> = new Set(["debug", "error", "info", "trace", "warn"]);

/**
 * Read the runtime config. Anything missing or unknown falls back to the safe default:
 * production, error-level logging. Local dev servers write a dev config.
 */
export const runtimeConfig = (): RuntimeConfig => {
  const raw = (globalThis.window !== undefined && globalThis.__APP_CONFIG__) || {};
  const appEnvironment = ENVS.has(raw.appEnv as AppEnv) ? (raw.appEnv as AppEnv) : "prod";
  const logLevel = LEVELS.has(raw.logLevel as LogLevel) ? (raw.logLevel as LogLevel) : "error";
  return {
    adminUrl: typeof raw.adminUrl === "string" ? raw.adminUrl : "/admin/",
    appEnv: appEnvironment,
    logLevel,
    sso: raw.sso !== false,
    staffUrl: typeof raw.staffUrl === "string" ? raw.staffUrl : "/",
  };
};
