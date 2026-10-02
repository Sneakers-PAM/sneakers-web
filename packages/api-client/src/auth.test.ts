import { readSsoReturn } from "#api/auth";

describe("readSsoReturn", () => {
  it("reads a second-factor challenge from the SSO hand-back", () => {
    expect(readSsoReturn("?sso_pending=p-1&factors=totp,email,bogus")).toEqual({
      factors: ["totp", "email"],
      kind: "challenge",
      pendingId: "p-1",
    });
  });

  it("reads a failure", () => {
    expect(readSsoReturn("?sso_error=no_user")).toEqual({ kind: "failed", reason: "no_user" });
  });

  it("is null for an ordinary visit", () => {
    expect(readSsoReturn("?next=/")).toBeNull();
  });
});
