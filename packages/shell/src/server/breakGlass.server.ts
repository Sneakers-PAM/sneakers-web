import {
  BreakGlassCurrentDocument,
  BreakGlassExitDocument,
  createLogger,
  GraphQLRequestError,
} from "@sneakers-web/api-client";
import { type ActionFunctionArgs, redirect } from "react-router";

import type { BreakGlassState } from "#shell/layout/BreakGlassBanner";

import { appPath } from "#shell/server/paths.server";
import { guard, isAdmin, requireUser, type SignedIn } from "#shell/server/session.server";

const log = createLogger("break-glass");

/**
 * The signed-in admin's open break-glass session for this web session, or null. Anyone who
 * can't break glass is never asked about; a failed check (an older gateway, a blip) reads as
 * off, the same as the appliance banners.
 */
export const breakGlassOf = async ({ gw, user }: SignedIn): Promise<BreakGlassState | null> => {
  if (!isAdmin(user)) return null;
  return gw
    .gql(BreakGlassCurrentDocument)
    .then((d) => d.breakGlassSession)
    .catch(() => null);
};

/** The banner's Exit: end the session, then back to the normal app. */
export const breakGlassExitAction = async ({ request }: ActionFunctionArgs) => {
  const { gw } = await requireUser(request);
  const body = await request.formData();
  const id = String(body.get("id") ?? "");
  await guard(request, () => gw.gql(BreakGlassExitDocument, { id })).catch((error: unknown) => {
    if (error instanceof Response) throw error;
    // Already over (expired, or ended in another tab): the normal app is where we go anyway.
    log.warn("break-glass exit refused", {
      reason: error instanceof GraphQLRequestError ? error.reason : undefined,
      sessionId: id,
    });
  });
  log.info("break-glass exit", { sessionId: id });
  return redirect(appPath("/"));
};
