export type AppEnvironment = "dev" | "prod" | "qa";
export type LogLevel = "debug" | "error" | "info" | "trace" | "warn";

/** The settings the browser may see. The server reads them from its environment and hands them to every page. */
export interface PublicConfig {
  /** Where the admin console lives, for the staff app's "Admin console" link. */
  adminUrl: string;
  appEnv: AppEnvironment;
  logLevel: LogLevel;
  /** Offer "Sign in with SSO" first. Off when the install has no SAML provider. */
  sso: boolean;
  /** Where the staff app lives, for the admin console's "User app" link. */
  staffUrl: string;
  version: string;
}

const ENVIRONMENTS = new Set<AppEnvironment>(["dev", "prod", "qa"]);
const LEVELS = new Set<LogLevel>(["debug", "error", "info", "trace", "warn"]);

/**
 * Read the public settings from the server's environment. Anything missing or unknown
 * falls back to the safe default: production, error-level logging, SSO offered.
 */
export const publicConfigFrom = (
  env: Record<string, string | undefined>,
  version: string,
): PublicConfig => ({
  adminUrl: env.ADMIN_URL || "/admin/",
  appEnv: ENVIRONMENTS.has(env.APP_ENV as AppEnvironment)
    ? (env.APP_ENV as AppEnvironment)
    : "prod",
  logLevel: LEVELS.has(env.LOG_LEVEL as LogLevel) ? (env.LOG_LEVEL as LogLevel) : "error",
  sso: env.SSO_ENABLED !== "false",
  staffUrl: env.STAFF_URL || "/",
  version,
});
