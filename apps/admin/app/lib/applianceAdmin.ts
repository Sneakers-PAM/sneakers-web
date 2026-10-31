/** The port the box serves its own admin pages on (sneakers-appliance's osadmin). */
const APPLIANCE_ADMIN_PORT = 8443;

// A host name or an IPv4 or IPv6 address, and nothing else: no path, port or user part.
const PLAIN_HOST =
  /^(?:[a-z\d](?:[a-z\d-]*[a-z\d])?(?:\.[a-z\d](?:[a-z\d-]*[a-z\d])?)*|[\da-f:.]+)$/i;

/**
 * The box's admin pages, from the host name the box reports for itself (diagnostics'
 * `box.fqdn`). Null when there's no box, or the box didn't say ("unknown").
 */
export const applianceAdminUrl = (fqdn: null | string | undefined): null | string => {
  const host = fqdn?.trim() ?? "";
  if (!host || host === "unknown" || !PLAIN_HOST.test(host)) return null;
  const isIpv6 = host.includes(":");
  if (isIpv6 && (host.match(/:/g)?.length ?? 0) < 2) return null;
  return `https://${isIpv6 ? `[${host}]` : host}:${APPLIANCE_ADMIN_PORT}/`;
};
