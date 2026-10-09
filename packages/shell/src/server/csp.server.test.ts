import { contentSecurityPolicy, newNonce } from "#shell/server/csp.server";

const directives = (policy: string) =>
  new Map(
    policy.split(";").map((part) => {
      const [name = "", ...values] = part.trim().split(/\s+/);
      return [name, values];
    }),
  );

describe("contentSecurityPolicy", () => {
  it("allows only this origin's scripts and the render's nonced inline ones", () => {
    const policy = directives(contentSecurityPolicy("abc123"));
    expect(policy.get("script-src")).toEqual(["'self'", "'nonce-abc123'"]);
    expect(policy.get("default-src")).toEqual(["'self'"]);
    expect(policy.get("connect-src")).toEqual(["'self'"]);
    expect(policy.get("img-src")).toEqual(["'self'", "data:", "blob:"]);
    expect(policy.get("object-src")).toEqual(["'none'"]);
  });

  it("can't be framed and takes no base URL, and allows no eval", () => {
    const text = contentSecurityPolicy("abc123");
    const policy = directives(text);
    expect(policy.get("frame-ancestors")).toEqual(["'none'"]);
    expect(policy.get("base-uri")).toEqual(["'none'"]);
    expect(text).not.toContain("unsafe-eval");
    expect(policy.get("script-src")).not.toContain("'unsafe-inline'");
  });
});

describe("newNonce", () => {
  it("is fresh for every response", () => {
    const a = newNonce();
    expect(a).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(newNonce()).not.toBe(a);
  });
});
