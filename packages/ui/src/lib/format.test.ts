import { plural, timeAgo } from "#ui/lib/format";

describe("timeAgo", () => {
  const now = Date.parse("2026-10-02T12:00:00Z");
  it.each([
    [now - 20_000, "just now"],
    [now - 5 * 60_000, "5 min ago"],
    [now - 3 * 3_600_000, "3 h ago"],
    [now - 30 * 3_600_000, "Yesterday"],
    [now - 4 * 86_400_000, "4 days ago"],
    [now - 9 * 86_400_000, "Last week"],
  ])("%s reads %s", (t, text) => {
    expect(timeAgo(t, now)).toBe(text);
  });

  it("is empty for a bad date", () => {
    expect(timeAgo("not a date", now)).toBe("");
  });
});

describe("plural", () => {
  it("picks the right form", () => {
    expect(plural(1, "secret")).toBe("1 secret");
    expect(plural(3, "secret")).toBe("3 secrets");
  });
});
