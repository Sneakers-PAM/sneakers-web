import { describe, expect, it } from "vitest";

import { appCommit, developmentQuickLoginBuild, MOCK_MODE } from "./index";

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
