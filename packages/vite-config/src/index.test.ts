import { describe, expect, it } from "vitest";

import { appCommit, developmentProxy, developmentQuickLoginBuild, MOCK_MODE } from "./index";

describe("the dev quick login build allowance", () => {
  it("is on for the dev server, which only ever runs locally", () => {
    expect(developmentQuickLoginBuild("development", {})).toBe(true);
  });

  it("is off for a production build unless the build asks for it", () => {
    expect(developmentQuickLoginBuild("production", {})).toBe(false);
    expect(
      developmentQuickLoginBuild("production", { SNEAKERS_DEV_QUICK_LOGIN_BUILD: "false" }),
    ).toBe(false);
    expect(developmentQuickLoginBuild("production", { SNEAKERS_DEV_QUICK_LOGIN_BUILD: "1" })).toBe(
      false,
    );
    expect(
      developmentQuickLoginBuild("production", { SNEAKERS_DEV_QUICK_LOGIN_BUILD: "true" }),
    ).toBe(true);
  });

  it("never applies to a mock build, which has its own quick login", () => {
    expect(developmentQuickLoginBuild(MOCK_MODE, { SNEAKERS_DEV_QUICK_LOGIN_BUILD: "true" })).toBe(
      false,
    );
  });
});

describe("the app commit", () => {
  it("comes from APP_COMMIT, then GITHUB_SHA, and is never undefined", () => {
    expect(appCommit({ APP_COMMIT: "abc123", GITHUB_SHA: "def456" })).toBe("abc123");
    expect(appCommit({ GITHUB_SHA: "def456" })).toBe("def456");
    expect(appCommit({})).toBe("unknown");
  });
});

describe("the dev server's proxy", () => {
  it("sends single sign-on to the gateway and the terminal's WebSocket to the SSH broker", () => {
    expect(developmentProxy({})).toEqual({
      "/auth/sso": { target: "http://localhost:9100" },
      "/ssh": { target: "http://localhost:9097", ws: true },
    });
  });

  it("takes the gateway's and the broker's addresses from the environment", () => {
    const proxy = developmentProxy({
      GATEWAY_URL: "http://gw:1",
      SSHBROKER_URL: "http://broker:2",
    });
    expect(proxy["/auth/sso"]).toEqual({ target: "http://gw:1" });
    expect(proxy["/ssh"]).toEqual({ target: "http://broker:2", ws: true });
  });
});
