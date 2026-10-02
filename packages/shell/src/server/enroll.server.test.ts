// @vitest-environment node
import { enrollAction, enrollLoader, type EnrollState } from "#shell/server/enroll.server";
import { requireUser } from "#shell/server/session.server";
import { signInAction } from "#shell/server/signIn.server";
import { appRequest, cookieFrom, form, withMockGateway } from "#shell/test/mockGateway";

withMockGateway();

const caught = async (p: Promise<unknown>): Promise<Response> => {
  try {
    await p;
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  }
  throw new Error("expected a thrown response");
};

/** Sign Dave in: MFA is enforced for him and he has no factor, so he gets the half session. */
const daveCookie = async () => {
  const request = appRequest("/sign-in", {
    body: form({ identifier: "dave", intent: "login", next: "/", password: "any" }),
    method: "POST",
  });
  const r = await caught(signInAction({ context: {}, params: {}, request } as never));
  return cookieFrom(r.headers);
};

describe("enrolment", () => {
  it("is a wall for an account that must enrol: no page opens until a factor is confirmed", async () => {
    const cookie = await daveCookie();
    const wall = await caught(requireUser(appRequest("/checkouts", { cookie })));
    expect(wall.headers.get("Location")).toBe("/enroll");

    const page = await enrollLoader({
      context: {},
      params: {},
      request: appRequest("/enroll", { cookie }),
    } as never);
    expect(page.enforced).toBe(true);
    expect(page.enrollment?.otpauthUri).toMatch(/^otpauth:\/\/totp\//);

    const post = (fields: Record<string, string>) =>
      enrollAction({
        context: {},
        params: {},
        request: appRequest("/enroll", {
          body: form({ next: "/", ...fields }),
          cookie,
          method: "POST",
        }),
      } as never);
    const wrong = (await post({ code: "000000", intent: "confirm" })) as unknown as {
      data: EnrollState;
    };
    expect(wrong.data).toEqual({ view: "form", wrong: true });

    const done = await caught(post({ code: "481027", intent: "confirm" }));
    expect(done.headers.get("Location")).toBe("/");
    const { user } = await requireUser(appRequest("/", { cookie }));
    expect(user.username).toBe("dave");
  });

  it("sends a visitor with no session to sign-in", async () => {
    const r = await caught(
      enrollLoader({ context: {}, params: {}, request: appRequest("/enroll") } as never),
    );
    expect(r.headers.get("Location")).toBe("/sign-in");
  });
});
