import { buildApplianceReport, buildApplianceReportText } from "@/lib/diagnostics/report";
import type { GetStatusResponse } from "@/lib/osadmin/types";

const status: GetStatusResponse = {
  channel: "stable",
  custodyMode: "tpm",
  failedVersion: "",
  health: [
    { detail: "", name: "netd", ok: true },
    { detail: "disk full", name: "backupd", ok: false },
  ],
  hostname: "appliance.example.org",
  managementAddresses: ["192.0.2.10"],
  ntpSynced: true,
  phase: "normal",
  protection: "PROTECTION_FULL",
  protectionReason: "",
  runningVersion: "0.1.0",
  stagedVersion: "0.2.0",
  tlsFingerprint: "aa:bb",
  tlsSelfSigned: true,
  version: "0.1.0",
  warnings: [],
};

describe("buildApplianceReport", () => {
  it("reports this build, with no gateway section", () => {
    const report = buildApplianceReport({ admin: { name: "alice", role: "ROLE_OWNER" }, status });
    const { app } = report;
    expect(app).toEqual({ commit: __APP_COMMIT__, name: "appliance-admin", version: __APP_VERSION__ });
    expect(report).not.toHaveProperty("gateway");
  });

  it("comes from the build's own commit and version, not a hardcoded one", () => {
    const report = buildApplianceReport({ admin: null, status: null });
    expect(report.app.commit).toBe(__APP_COMMIT__);
    expect(report.app.version).toBe(__APP_VERSION__);
  });

  it("names the signed-in admin and their role", () => {
    const owner = buildApplianceReport({ admin: { name: "alice", role: "ROLE_OWNER" }, status });
    expect(owner.admin).toEqual({ name: "alice", role: "owner" });
    const admin = buildApplianceReport({ admin: { name: "bob", role: "ROLE_ADMIN" }, status });
    expect(admin.admin).toEqual({ name: "bob", role: "admin" });
  });

  it("says not signed in when there's no session", () => {
    const report = buildApplianceReport({ admin: null, status });
    expect(report.admin).toBeNull();
  });

  it("reports the box's version, slot, protection and Secure Boot state", () => {
    const report = buildApplianceReport({ admin: null, status });
    expect(report.box).toEqual({
      protection: "full",
      secureBoot: "on",
      slot: "running 0.1.0, staged 0.2.0 in the other slot",
      version: "0.1.0",
    });
  });

  it("reports Secure Boot off and reduced protection from protectionReason", () => {
    const report = buildApplianceReport({
      admin: null,
      status: { ...status, protection: "PROTECTION_REDUCED", protectionReason: "secure-boot-off" },
    });
    expect(report.box?.protection).toBe("reduced");
    expect(report.box?.secureBoot).toBe("off");
  });

  it("reports an empty other slot", () => {
    const report = buildApplianceReport({ admin: null, status: { ...status, stagedVersion: "" } });
    expect(report.box?.slot).toBe("running 0.1.0, other slot empty");
  });

  it("says the box couldn't be read when there's no status", () => {
    const report = buildApplianceReport({ admin: null, status: null });
    expect(report.box).toBeNull();
  });

  it("carries the service health osadmin reported", () => {
    const report = buildApplianceReport({ admin: null, status });
    expect(report.health).toEqual([
      { detail: "", name: "netd", ok: true },
      { detail: "disk full", name: "backupd", ok: false },
    ]);
  });

  it("is an empty list when the box leaves health out of the reply", () => {
    const { health, ...rest } = status;
    const report = buildApplianceReport({ admin: null, status: rest as GetStatusResponse });
    expect(report.health).toEqual([]);
  });
});

describe("buildApplianceReportText", () => {
  it("matches the report's own fields, with no gateway line", () => {
    const report = buildApplianceReport({ admin: { name: "alice", role: "ROLE_OWNER" }, status });
    const text = buildApplianceReportText(report);
    expect(text).toContain(`App: appliance-admin ${report.app.version} (${report.app.commit})`);
    expect(text).toContain("Signed in as: alice (owner)");
    expect(text).toContain(`Box version: ${report.box?.version}`);
    expect(text).toContain(`Slot: ${report.box?.slot}`);
    expect(text).toContain("Protection: full");
    expect(text).toContain("Secure Boot: on");
    expect(text).toContain("netd: ok");
    expect(text).toContain("backupd: disk full");
    expect(text.toLowerCase()).not.toContain("gateway");
    expect(JSON.parse(text.split("```json\n")[1]!.split("\n```")[0]!)).toEqual(report);
  });
});
