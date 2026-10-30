import { createLogger } from "@sneakers-web/api-client";
import { requireUser } from "@sneakers-web/shell/server";

const log = createLogger("cli-sign-in");

/** The commands that sign in through the browser; any other `client` is shown generically. */
const COMMANDS = ["sneakers-put", "sneakers-run"] as const;

/** Why a command-line sign-in failed, as the command's loopback listener reports it. */
const REASONS = ["denied", "exchange", "failed", "state"] as const;

export type CliCommand = (typeof COMMANDS)[number];
export type CliReason = (typeof REASONS)[number];

export interface CliSignedInData {
  command: CliCommand | null;
  reason: CliReason | null;
  user: { email: string; name: string };
}

const known = <T extends string>(list: readonly T[], value: null | string): null | T =>
  list.find((x) => x === value) ?? null;

/**
 * Where `sneakers-put login` and `sneakers-run login` send the browser once the sign-in is
 * back in the terminal: `?client=<command>`, plus `&reason=` when it failed. Only the known
 * command names and reasons are shown, so the page never repeats text from the link.
 */
export const loadCliSignedIn = async (request: Request): Promise<CliSignedInData> => {
  const { user } = await requireUser(request);
  const q = new URL(request.url).searchParams;
  const command = known(COMMANDS, q.get("client"));
  const reason = q.has("reason") ? (known(REASONS, q.get("reason")) ?? "failed") : null;
  log.info(reason ? "command-line sign-in failed" : "command-line sign-in finished", {
    command: command ?? "unknown",
    reason: reason ?? undefined,
  });
  return { command, reason, user: { email: user.email, name: user.name } };
};
