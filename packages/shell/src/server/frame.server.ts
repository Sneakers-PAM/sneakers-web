import { ApplianceStatusDocument, UnreadCountDocument } from "@sneakers-web/api-client";

import type { BreakGlassState } from "#shell/layout/BreakGlassBanner";

import { breakGlassOf } from "#shell/server/breakGlass.server";
import { isAdmin, requireUser, type SessionUser } from "#shell/server/session.server";

export interface FrameData {
  /** The admin's open break-glass session in this web session; null when not in that mode. */
  breakGlass: BreakGlassState | null;
  isAdmin: boolean;
  /** Read-only maintenance is on, from the appliance; show the banner. */
  maintenance: boolean;
  /** Why, when the appliance gave a reason; null otherwise. */
  maintenanceReason: null | string;
  /** The MCP is off, from the appliance; show the notice. */
  mcpOff: boolean;
  /** MFA is optional and this user has no factor: show the nudge. */
  mfaSetupRecommended: boolean;
  unread: number;
  user: SessionUser;
}

const DEFAULT_APPLIANCE = { maintenance: false, maintenanceReason: null, mcpOff: false };

/** What every signed-in page's frame shows: who you are, the MFA nudge and the unread count. */
export const frameData = async (request: Request): Promise<FrameData> => {
  const signedIn = await requireUser(request);
  const { gw, session, user } = signedIn;
  const unread = await gw
    .gql(UnreadCountDocument)
    .then((d) => d.myUnreadNotificationCount)
    .catch(() => 0);
  const { maintenance, maintenanceReason, mcpOff } = await gw
    .gql(ApplianceStatusDocument)
    .then((d) => ({
      maintenance: d.appliance.maintenance,
      maintenanceReason: d.appliance.maintenanceReason,
      mcpOff: d.appliance.mcp === "off",
    }))
    .catch(() => DEFAULT_APPLIANCE);
  return {
    breakGlass: await breakGlassOf(signedIn),
    isAdmin: isAdmin(user),
    maintenance,
    maintenanceReason,
    mcpOff,
    mfaSetupRecommended: session.setupRecommended,
    unread,
    user,
  };
};
