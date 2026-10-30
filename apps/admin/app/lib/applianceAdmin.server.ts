import { ApplianceAdminHostDocument, createLogger } from "@sneakers-web/api-client";
import { requireUser } from "@sneakers-web/shell/server";

import { applianceAdminUrl } from "@/lib/applianceAdmin";

const log = createLogger("admin.appliance-link");

/**
 * The box's :8443 admin pages for root, or null: for anyone else, off an appliance, or when the
 * box didn't give its host name. The link carries no session; the box keeps its own sign-in.
 */
export const applianceAdminLink = async (request: Request): Promise<null | string> => {
  const { gw, user } = await requireUser(request);
  if (!user.isRoot) return null;
  try {
    const { diagnostics } = await gw.gql(ApplianceAdminHostDocument);
    const url = applianceAdminUrl(diagnostics.box?.fqdn);
    log.debug("appliance admin link", { onBox: !!diagnostics.box, shown: !!url });
    return url;
  } catch (error) {
    log.warn("appliance admin link: no box host name", { error: String(error) });
    return null;
  }
};
