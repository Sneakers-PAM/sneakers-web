import type { Component, GetStatusResponse, Role } from "@/lib/osadmin/types";

export interface ApplianceDiagnosticsReport {
  admin: null | { name: string; role: string };
  app: { commit: string; name: string; version: string };
  box: null | { protection: string; secureBoot: string; slot: string; version: string };
  health: Component[];
}

export interface ApplianceReportInput {
  admin: null | { name: string; role: Role };
  status: GetStatusResponse | null;
}

const roleLabel = (role: Role): string => (role === "ROLE_OWNER" ? "owner" : "admin");

const secureBootState = (status: GetStatusResponse): string => {
  if (status.protectionReason === "secure-boot-off") return "off";
  if (status.protectionReason === "no-secure-boot-firmware") return "not supported by this firmware";
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
  const lines = [
    "Sneakers-PAM appliance admin diagnostics",
    `App: ${report.app.name} ${report.app.version} (${report.app.commit})`,
    report.admin
      ? `Signed in as: ${report.admin.name} (${report.admin.role})`
      : "Signed in as: not signed in",
  ];
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
  lines.push("Service health:", ...report.health.map((c) => healthLine(c)));
  return `${lines.join("\n")}\n\n\`\`\`json\n${JSON.stringify(report, null, 2)}\n\`\`\`\n`;
};
