// @vitest-environment node
import { edge } from "#mock/edge.server";
import { MOCK_MFA_MAX_AGE_MS } from "#mock/handlers/stepUp";
import { MOCK_SESSION_COOKIE, mockState } from "#mock/state";
import { withMockGateway } from "#mock/testing";

withMockGateway();

const quick = () => {
  if (!edge.quickLogin) throw new Error("the mock edge offers a dev quick login");
  return edge.quickLogin;
};

const sessionOf = (cookie: string) => {
  const sid = cookie.split(";", 1)[0]?.split("=", 2)[1] ?? "";
  return mockState.sessions.get(sid);
};

describe("the dev quick login", () => {
  it("offers every enabled fixture user, saying what each one is for", () => {
    const users = quick().users();
    const byId = Object.fromEntries(users.map((u) => [u.id, u]));
    expect(byId["mock-user-alice"]?.note).toMatch(/site admin/i);
    expect(byId["mock-user-bob"]).toBeDefined();
    expect(byId["mock-user-dave"]?.note).toMatch(/must enrol/i);
    expect(users.some((u) => /recovery/i.test(u.note))).toBe(true);
    expect(byId["mock-user-erin"]).toBeUndefined();
  });

  it("signs in as a user with a fresh second factor", () => {
    const r = quick().signIn("mock-user-alice");
    expect(r?.enroll).toBe(false);
    expect(r?.cookie).toMatch(new RegExp(`^${MOCK_SESSION_COOKIE}=[^;]+; Path=/; HttpOnly`));
    const s = sessionOf(r?.cookie ?? "");
    expect(s).toMatchObject({
      enrollmentRequired: false,
      mfaVerified: true,
      userId: "mock-user-alice",
    });
    expect(Date.now() - (s?.mfaVerifiedAt ?? 0)).toBeLessThan(MOCK_MFA_MAX_AGE_MS);
  });

  it("sends a user who must enrol to enrolment, with only a half session", () => {
    const r = quick().signIn("mock-user-dave");
    expect(r?.enroll).toBe(true);
    expect(sessionOf(r?.cookie ?? "")).toMatchObject({
      enrollmentRequired: true,
      mfaVerified: false,
    });
  });

  it("refuses a disabled or unknown user", () => {
    expect(quick().signIn("mock-user-erin")).toBeNull();
    expect(quick().signIn("mock-user-nobody")).toBeNull();
  });
});
