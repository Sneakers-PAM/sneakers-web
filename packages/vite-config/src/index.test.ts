import { describe, expect, it } from "vitest";

import { developmentQuickLoginBuild, MOCK_MODE } from "./index";

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
