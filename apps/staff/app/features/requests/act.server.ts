import { createLogger, type GatewayClient } from "@sneakers-web/api-client";
import { type Refusal, refusalOf } from "@sneakers-web/shell";
import { guard, requireUser, type SessionUser } from "@sneakers-web/shell/server";

const log = createLogger("requests");

/** What a requests or checkouts action answers: done (with a note for the toast), or the refusal. */
export type ActResult =
  { done: string; intent: string; ok: true } | { intent: string; ok: false; refusal: Refusal };

/**
 * Run one form intent as the signed-in user. A gateway refusal comes back as data, so the
 * page can say what went wrong; session trouble still goes to sign-in.
 */
export const act = async (
  request: Request,
  intent: string,
  work: (gw: GatewayClient, user: SessionUser) => Promise<string>,
): Promise<ActResult> => {
  const { gw, user } = await requireUser(request);
  log.debug("action", { intent });
  return guard(request, async () => {
    try {
      const done = await work(gw, user);
      log.info("action done", { intent });
      return { done, intent, ok: true as const };
    } catch (error) {
      const refusal = refusalOf(error);
      if (!refusal) {
        log.error("action failed", { error: String(error), intent });
        throw error;
      }
      log.info("action refused", { code: refusal.code, intent, reason: refusal.reason });
      return { intent, ok: false as const, refusal };
    }
  });
};

export const field = (form: FormData, key: string): string => String(form.get(key) ?? "").trim();
