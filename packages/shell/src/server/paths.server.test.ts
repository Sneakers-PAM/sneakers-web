// @vitest-environment node
import { edge as live } from "#api/edge/live.server";
import { edge as mock } from "#mock/edge.server";
import { appPath, safeNext } from "#shell/server/paths.server";

describe("app paths", () => {
  it("are base-free, because React Router adds the basename itself", () => {
    expect(appPath("sign-in")).toBe("/sign-in");
    expect(appPath("/folders")).toBe("/folders");
  });

  it("only follow a next link that stays inside the app", () => {
    expect(safeNext("/users?q=a")).toBe("/users?q=a");
    expect(safeNext("//elsewhere.example.org/")).toBe("/");
    expect(safeNext("https://elsewhere.example.org/")).toBe("/");
    expect(safeNext(String.raw`/\elsewhere.example.org`)).toBe("/");
    expect(safeNext(null)).toBe("/");
  });

  it("start single sign-on at an absolute URL, so the admin base is never added twice", () => {
    expect(live.ssoStart("https://pam.example.org", "/admin/")).toBe(
      "https://pam.example.org/auth/sso/login",
    );
    expect(mock.ssoStart("http://localhost:3201", "/admin/")).toMatch(
      /^http:\/\/localhost:3201\/admin\/sign-in\?sso_pending=/,
    );
  });
});
