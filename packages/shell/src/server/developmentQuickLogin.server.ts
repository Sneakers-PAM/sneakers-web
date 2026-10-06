import { createLogger, type QuickLoginUser } from "@sneakers-web/api-client";
import { readFileSync } from "node:fs";

const log = createLogger("dev-quick-login");

/** A local dev account from the users file. The password never leaves the server. */
export interface DevelopmentQuickLoginAccount {
  label: string;
  note: string;
  password: string;
  username: string;
}

const text = (value: unknown): string => (typeof value === "string" ? value : "");

/**
 * The local dev accounts the quick login offers on a live build, read on every call from the
 * JSON file SNEAKERS_DEV_QUICK_LOGIN_USERS names: a list of `{ username, password, label?,
 * note? }`. Empty unless the server sets SNEAKERS_DEV_QUICK_LOGIN=true. Callers check the
 * build's allowance first, so a release build drops this module.
 */
export const developmentQuickLoginAccounts = (
  environment: NodeJS.ProcessEnv = process.env,
): DevelopmentQuickLoginAccount[] => {
  if (environment.SNEAKERS_DEV_QUICK_LOGIN !== "true") return [];
  const file = environment.SNEAKERS_DEV_QUICK_LOGIN_USERS;
  if (!file) {
    log.warn("dev quick login is on but SNEAKERS_DEV_QUICK_LOGIN_USERS names no file");
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    log.warn("dev quick login users file can't be read", {
      error: error instanceof Error ? error.name : "unknown",
    });
    return [];
  }
  if (!Array.isArray(parsed)) {
    log.warn("dev quick login users file is not a list");
    return [];
  }
  const accounts = parsed.flatMap((entry: unknown) => {
    const fields = (entry ?? {}) as Record<string, unknown>;
    const username = text(fields.username);
    const password = text(fields.password);
    if (!username || !password) return [];
    return [{ label: text(fields.label) || username, note: text(fields.note), password, username }];
  });
  log.debug("dev quick login users loaded", { count: accounts.length });
  return accounts;
};

/** What the page may see of an account: its username, label and note. */
export const developmentQuickLoginUser = (a: DevelopmentQuickLoginAccount): QuickLoginUser => ({
  id: a.username,
  label: a.label,
  note: a.note,
});
