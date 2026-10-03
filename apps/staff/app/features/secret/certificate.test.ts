import { certExpiry, EXPORT_FORMATS, exportBlocked, keyLabel } from "@/features/secret/certificate";

const DAY = 86_400_000;
const now = Date.parse("2026-10-01T12:00:00Z");

describe("certificate helpers", () => {
  it("calls a certificate valid, expiring inside 30 days, or expired", () => {
    expect(certExpiry(new Date(now + 90 * DAY).toISOString(), now)).toEqual({
      days: 90,
      label: "Valid · 90d",
      tone: "ok",
    });
    expect(certExpiry(new Date(now + 12 * DAY).toISOString(), now)).toEqual({
      days: 12,
      label: "Expiring · 12d",
      tone: "warn",
    });
    expect(certExpiry(new Date(now - 2 * DAY).toISOString(), now)).toEqual({
      days: -2,
      label: "Expired",
      tone: "danger",
    });
    expect(certExpiry("", now)).toEqual({ days: null, label: "Unknown", tone: "neutral" });
  });

  it("names the key the way people say it", () => {
    expect(keyLabel("ECDSA", "256")).toBe("ECDSA P-256");
    expect(keyLabel("RSA", "4096")).toBe("RSA 4096");
    expect(keyLabel("", "")).toBe("Unknown");
  });

  it("blocks keyed formats without a key, and containers without a passphrase", () => {
    const pkcs12 = EXPORT_FORMATS.find((f) => f.value === "pkcs12")!;
    const pem = EXPORT_FORMATS.find((f) => f.value === "pem-fullchain")!;
    expect(exportBlocked(pem, false, "")).toBe(false);
    expect(exportBlocked(pkcs12, false, "x")).toBe(true);
    expect(exportBlocked(pkcs12, true, "")).toBe(true);
    expect(exportBlocked(pkcs12, true, "x")).toBe(false);
  });
});
