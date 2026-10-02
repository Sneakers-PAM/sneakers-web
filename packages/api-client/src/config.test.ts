import { publicConfigFrom } from "#api/config";

describe("publicConfigFrom", () => {
  it("defaults to production with error-level logs and SSO on", () => {
    expect(publicConfigFrom({}, "1.2.3")).toEqual({
      adminUrl: "/admin/",
      appEnv: "prod",
      logLevel: "error",
      sso: true,
      staffUrl: "/",
      version: "1.2.3",
    });
  });

  it("reads the deployment's settings and ignores unknown values", () => {
    const c = publicConfigFrom({ APP_ENV: "qa", LOG_LEVEL: "loud", SSO_ENABLED: "false" }, "0");
    expect(c.appEnv).toBe("qa");
    expect(c.logLevel).toBe("error");
    expect(c.sso).toBe(false);
  });
});
