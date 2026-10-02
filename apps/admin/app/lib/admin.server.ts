import type { GatewayClient } from "@sneakers-web/api-client";

import { refusalOf, type Refusal } from "@sneakers-web/shell";
import { guard, requireUser, type SessionUser } from "@sneakers-web/shell/server";
import { data } from "react-router";

/** What every admin action answers: done (with a note for the toast), or the refusal. */
export type ActionResult =
  { done: string; intent: string; ok: true } | { intent: string; ok: false; refusal: Refusal };

/**
 * Load a page's data as the signed-in user. A refusal (not a site admin, a missing item)
 * becomes a 403 or 404 for the page's error boundary; session trouble goes to sign-in.
 */
export const adminLoad = async <T>(
  request: Request,
  work: (gw: GatewayClient, user: SessionUser) => Promise<T>,
): Promise<T> => {
  const { gw, user } = await requireUser(request);
  return guard(request, async () => {
    try {
      return await work(gw, user);
    } catch (error) {
      const refusal = refusalOf(error);
      if (!refusal) throw error;
      throw data(refusal, { status: refusal.code === "NOT_FOUND" ? 404 : 403 });
    }
  });
};

/** Run one form intent. A refusal comes back as data, so the page can say what went wrong. */
export const adminAct = async (
  request: Request,
  intent: string,
  work: (gw: GatewayClient, user: SessionUser) => Promise<string>,
): Promise<ActionResult> => {
  const { gw, user } = await requireUser(request);
  return guard(request, async () => {
    try {
      return { done: await work(gw, user), intent, ok: true as const };
    } catch (error) {
      const refusal = refusalOf(error);
      if (!refusal) throw error;
      return { intent, ok: false as const, refusal };
    }
  });
};

export const text = (form: FormData, key: string): string => String(form.get(key) ?? "").trim();
