import {
  formatBytes,
  formatDate,
  formatDateTime,
  formatNumber,
  formatRelativeTime,
  formatTime,
} from "#i18n/format";

const at = new Date("2026-10-05T13:14:15Z");

describe("formatting goes through Intl", () => {
  it("formats numbers for the locale", () => {
    expect(formatNumber(1_234_567.5, "en")).toBe("1,234,567.5");
    expect(formatNumber(1_234_567.5, "de")).toBe("1.234.567,5");
  });

  it("formats a date and a time in the given zone, and an empty string for a bad value", () => {
    expect(formatDate(at, "en", { timeZone: "UTC" })).toBe("Oct 5, 2026");
    expect(formatTime(at, "en", { timeZone: "UTC" })).toBe("13:14");
    expect(formatDateTime(at, "en", { timeZone: "UTC" })).toBe("Oct 5, 2026, 13:14");
    expect(formatDate(at, "en", { month: "long", timeZone: "UTC" })).toBe("October");
    expect(formatDate("not a date", "en")).toBe("");
    expect(formatTime(Number.NaN, "en")).toBe("");
  });

  it("formats a size in the biggest fitting unit", () => {
    expect(formatBytes(0, "en")).toBe("0 bytes");
    expect(formatBytes(512, "en")).toBe("512 bytes");
    expect(formatBytes(1536, "en")).toBe("1.5 kB");
    expect(formatBytes(5 * 1024 * 1024, "en")).toBe("5 MB");
    expect(formatBytes(3 * 1024 ** 3, "en")).toBe("3 GB");
  });

  it("says how long ago or from now, in words", () => {
    const now = new Date("2026-10-05T13:00:00Z");
    expect(formatRelativeTime(new Date("2026-10-05T12:59:30Z"), now, "en")).toBe("30 seconds ago");
    expect(formatRelativeTime(new Date("2026-10-05T12:55:00Z"), now, "en")).toBe("5 minutes ago");
    expect(formatRelativeTime(new Date("2026-10-05T15:00:00Z"), now, "en")).toBe("in 2 hours");
    expect(formatRelativeTime(new Date("2026-10-04T13:00:00Z"), now, "en")).toBe("yesterday");
    expect(formatRelativeTime("nope", now, "en")).toBe("");
  });
});
