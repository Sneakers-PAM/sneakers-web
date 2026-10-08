import type { DiagnosticsCopier } from "@sneakers-web/shell";

import { buildApplianceReport, buildApplianceReportText } from "@/lib/diagnostics/report";
import { status } from "@/lib/osadmin/client";
import { getSession } from "@/lib/osadmin/sessionStore";

/**
 * The appliance admin's Copy diagnostics on its problem screens (crash, not found, offline,
 * sign in again, not allowed, the box had a problem): the appliance report with the page, the
 * problem, the time and the browser. The shell's default asks the product's app server, which
 * this box doesn't run.
 */
export const copyApplianceDiagnostics: DiagnosticsCopier = async ({ problem }) => {
  const session = getSession();
  const box = await status.get().catch(() => null);
  const text = buildApplianceReportText(
    buildApplianceReport({
      admin: session ? { name: session.admin, role: session.role } : null,
      context: {
        now: new Date(),
        page: globalThis.location.pathname,
        problem,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        userAgent: navigator.userAgent,
      },
      status: box,
    }),
  );
  await navigator.clipboard.writeText(text);
  return text;
};
