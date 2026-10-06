import { buildIssueCopyBundle, type IssueCopyError, issueCopyLine } from "#shell/issueCopy/bundle";

const NOW = new Date("2026-10-06T18:05:09Z"); // 14:05:09 ET (daylight time, UTC-4)

const base = {
  app: "staff",
  dpr: 2,
  errors: [] as IssueCopyError[],
  now: NOW,
  sha: "352a58c",
  ua: "Mozilla/5.0",
  vh: 900,
  vw: 1440,
};

describe("buildIssueCopyBundle", () => {
  it("keeps the schema v1 keys in their fixed order, product right after v", () => {
    const bundle = buildIssueCopyBundle({
      ...base,
      clicked: "[data-testid=secret-reveal]",
      locale: "en-US",
      params: { id: "sec_01H" },
      path: "/secret/:id",
      role: "site-admin",
      route: "routes/secret",
      theme: "dark",
    });
    expect(Object.keys(bundle)).toEqual([
      "v",
      "product",
      "app",
      "sha",
      "route",
      "path",
      "params",
      "role",
      "vw",
      "vh",
      "dpr",
      "ua",
      "t",
      "theme",
      "locale",
      "clicked",
    ]);
    expect(bundle.v).toBe(1);
    expect(bundle.product).toBe("sneakers");
  });

  it("writes one minified line of JSON with that same key order", () => {
    const line = issueCopyLine({ ...base, role: "site-admin", route: "routes/secret" });
    expect(line).not.toContain("\n");
    expect(line.indexOf('"v"')).toBeLessThan(line.indexOf('"product"'));
    expect(line.indexOf('"product"')).toBeLessThan(line.indexOf('"app"'));
  });

  it("omits a key with no value instead of setting it to null", () => {
    const bundle = buildIssueCopyBundle(base);
    expect(bundle).not.toHaveProperty("route");
    expect(bundle).not.toHaveProperty("path");
    expect(bundle).not.toHaveProperty("params");
    expect(bundle).not.toHaveProperty("role");
    expect(bundle).not.toHaveProperty("theme");
    expect(bundle).not.toHaveProperty("locale");
    expect(bundle).not.toHaveProperty("clicked");
    expect(bundle).not.toHaveProperty("lastErr");
    expect(bundle).not.toHaveProperty("recentErrors");
    expect(JSON.stringify(bundle)).not.toMatch(/null/);
  });

  it("drops an empty params object instead of shipping {}", () => {
    const bundle = buildIssueCopyBundle({ ...base, params: {} });
    expect(bundle).not.toHaveProperty("params");
  });

  it("splits the ring buffer: lastErr is the newest, recentErrors the rest", () => {
    const errors: IssueCopyError[] = [
      { at: "2026-10-06T14:05:00-04:00", m: "newest", src: "window" },
      { at: "2026-10-06T14:04:00-04:00", m: "second", src: "fetch" },
      { at: "2026-10-06T14:03:00-04:00", m: "third", src: "promise" },
    ];
    const bundle = buildIssueCopyBundle({ ...base, errors });
    expect(bundle.lastErr).toEqual(errors[0]);
    expect(bundle.recentErrors).toEqual([errors[1], errors[2]]);
  });

  it("redacts a secret-looking route param, the same as the logger", () => {
    const bundle = buildIssueCopyBundle({
      ...base,
      params: { id: "sec_01H", token: "snk_abc123" },
      role: "site-admin",
    });
    expect(JSON.stringify(bundle)).not.toMatch(/snk_abc123/);
  });

  it("has no fixed field for a username, display name or email at all", () => {
    const bundle = buildIssueCopyBundle({ ...base, role: "site-admin" });
    expect(Object.keys(bundle)).not.toContain("username");
    expect(Object.keys(bundle)).not.toContain("displayName");
    expect(Object.keys(bundle)).not.toContain("email");
  });

  it("writes the time as ISO 8601 with the US Eastern offset", () => {
    const bundle = buildIssueCopyBundle(base);
    expect(bundle.t).toBe("2026-10-06T14:05:09-04:00");
    const winter = buildIssueCopyBundle({ ...base, now: new Date("2026-01-06T18:05:09Z") });
    expect(winter.t).toBe("2026-01-06T13:05:09-05:00");
  });
});
