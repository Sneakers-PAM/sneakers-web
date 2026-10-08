import type { Problem } from "@sneakers-web/shell";

import type { Component, GetStatusResponse, Role } from "@/lib/osadmin/types";

export interface ApplianceDiagnosticsReport {
  admin: null | { name: string; role: string };
  app: { commit: string; name: string; version: string };
  box: null | { protection: string; secureBoot: string; slot: string; version: string };
  /** Where and when, for a report copied from a problem screen; About leaves it out. */
  context?: ApplianceReportContextOut;
  health: Component[];
}

interface ApplianceReportContextOut {
  browser: string;
  page: string;
  problem: null | Problem;
  time: { local: string; timeZone: string; utc: string };
}

/** What a problem screen adds: the page, the problem it showed, the time and the browser. */
export interface ApplianceReportContext {
  now: Date;
  page: string;
  problem?: Problem;
  timeZone: string;
  userAgent: string;
}

export interface ApplianceReportInput {
  admin: null | { name: string; role: Role };
  context?: ApplianceReportContext;
  status: GetStatusResponse | null;
}

const localTime = (now: Date, timeZone: string): string => {
  try {
    return new Intl.DateTimeFormat("sv-SE", {
      day: "2-digit",
      hour: "2-digit",
      hour12: false,
      minute: "2-digit",
      month: "2-digit",
      second: "2-digit",
      timeZone,
      year: "numeric",
    }).format(now);
  } catch {
    return now.toISOString();
  }
};

const contextOf = (c: ApplianceReportContext): ApplianceReportContextOut => ({
  browser: c.userAgent,
  page: c.page,
  problem: c.problem ?? null,
  time: { local: localTime(c.now, c.timeZone), timeZone: c.timeZone, utc: c.now.toISOString() },
});

const roleLabel = (role: Role): string => (role === "ROLE_OWNER" ? "owner" : "admin");

const secureBootState = (status: GetStatusResponse): string => {
  if (status.protectionReason === "secure-boot-off") return "off";
  if (status.protectionReason === "no-secure-boot-firmware")
    return "not supported by this firmware";
  return "on";
};

const slotState = (status: GetStatusResponse): string =>
  status.stagedVersion
    ? `running ${status.runningVersion}, staged ${status.stagedVersion} in the other slot`
    : `running ${status.runningVersion}, other slot empty`;

/**
 * The appliance admin's own About and diagnostics (issue #202): this build, the signed-in
 * admin and the box, never the Sneakers gateway -- there isn't one at this app's base path.
 */
export const buildApplianceReport = (input: ApplianceReportInput): ApplianceDiagnosticsReport => ({
  ...(input.context ? { context: contextOf(input.context) } : {}),
  admin: input.admin ? { name: input.admin.name, role: roleLabel(input.admin.role) } : null,
  app: { commit: __APP_COMMIT__, name: "appliance-admin", version: __APP_VERSION__ },
  box: input.status
    ? {
        protection: input.status.protection === "PROTECTION_FULL" ? "full" : "reduced",
        secureBoot: secureBootState(input.status),
        slot: slotState(input.status),
        version: input.status.version,
      }
    : null,
  health: input.status?.health ?? [],
});

const healthLine = (c: Component): string => `  ${c.name}: ${c.ok ? "ok" : c.detail || "not ok"}`;

/** `buildApplianceReport`'s report as plain text with a JSON block, for the clipboard. */
export const buildApplianceReportText = (report: ApplianceDiagnosticsReport): string => {
  const where = report.context;
  const lines = ["Sneakers-PAM appliance admin diagnostics"];
  if (where) {
    const { local, timeZone, utc } = where.time;
    lines.push(`Time: ${utc} (${local} ${timeZone})`, `Page: ${where.page}`);
    if (where.problem) lines.push(`Problem: ${where.problem.message ?? "(no message)"}`);
  }
  lines.push(
    `App: ${report.app.name} ${report.app.version} (${report.app.commit})`,
    report.admin
      ? `Signed in as: ${report.admin.name} (${report.admin.role})`
      : "Signed in as: not signed in",
  );
  if (report.box) {
    lines.push(
      `Box version: ${report.box.version}`,
      `Slot: ${report.box.slot}`,
      `Protection: ${report.box.protection}`,
      `Secure Boot: ${report.box.secureBoot}`,
    );
  } else {
    lines.push("Box: couldn't be read");
  }
  lines.push("Service health:", ...report.health.map((h) => healthLine(h)));
  if (where) lines.push(`Browser: ${where.browser}`);
  return `${lines.join("\n")}\n\n\`\`\`json\n${JSON.stringify(report, null, 2)}\n\`\`\`\n`;
};
