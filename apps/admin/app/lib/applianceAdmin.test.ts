import { applianceAdminUrl } from "@/lib/applianceAdmin";

describe("applianceAdminUrl", () => {
  it("is the box's own admin pages on :8443, from its host name", () => {
    expect(applianceAdminUrl("box.example.org")).toBe("https://box.example.org:8443/");
  });

  it("takes an address the box gives instead of a name", () => {
    expect(applianceAdminUrl("192.0.2.10")).toBe("https://192.0.2.10:8443/");
    expect(applianceAdminUrl("2001:db8::10")).toBe("https://[2001:db8::10]:8443/");
  });

  it("is null when the box didn't say, or there's no box", () => {
    expect(applianceAdminUrl("unknown")).toBeNull();
    expect(applianceAdminUrl("")).toBeNull();
    expect(applianceAdminUrl(null)).toBeNull();
  });

  it("is null for a value that isn't a plain host", () => {
    expect(applianceAdminUrl("box.example.org/evil")).toBeNull();
    expect(applianceAdminUrl("user@box.example.org")).toBeNull();
    expect(applianceAdminUrl("box.example.org:9000")).toBeNull();
  });
});
