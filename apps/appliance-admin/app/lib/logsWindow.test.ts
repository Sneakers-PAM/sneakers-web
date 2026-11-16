import { logsQuery, LogsWindowError } from "@/lib/logsWindow";

describe("logsQuery", () => {
  it("asks for a preset by its name", () => {
    expect(logsQuery({ preset: "15m" })).toBe("window=15m");
    expect(logsQuery({ preset: "24h" })).toBe("window=24h");
  });

  it("sends a custom range as RFC 3339 UTC, both ends, to the second", () => {
    expect(logsQuery({ from: "2026-11-16T10:00:00.000Z", to: "2026-11-16T12:30:00.000Z" })).toBe(
      "from=2026-11-16T10%3A00%3A00Z&to=2026-11-16T12%3A30%3A00Z",
    );
  });

  it("accepts a span of exactly seven days", () => {
    expect(() =>
      logsQuery({ from: "2026-11-09T10:00:00Z", to: "2026-11-16T10:00:00Z" }),
    ).not.toThrow();
  });

  it.each([
    ["an end before the start", { from: "2026-11-16T12:00:00Z", to: "2026-11-16T10:00:00Z" }],
    ["an empty range", { from: "2026-11-16T10:00:00Z", to: "2026-11-16T10:00:00Z" }],
    ["a span over seven days", { from: "2026-11-09T09:59:00Z", to: "2026-11-16T10:00:00Z" }],
    ["a missing start", { from: "", to: "2026-11-16T10:00:00Z" }],
    ["a missing end", { from: "2026-11-16T10:00:00Z", to: "" }],
    ["a date that isn't one", { from: "soon", to: "2026-11-16T10:00:00Z" }],
  ])("refuses %s before anything is sent", (_, range) => {
    expect(() => logsQuery(range)).toThrow(LogsWindowError);
  });

  it("says why in words an admin can act on", () => {
    expect(() => logsQuery({ from: "2026-11-01T00:00:00Z", to: "2026-11-16T10:00:00Z" })).toThrow(
      "The range can be at most 7 days.",
    );
  });
});
