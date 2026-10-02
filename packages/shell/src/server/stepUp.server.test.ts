// @vitest-environment node
import { freshMfa } from "@sneakers-web/mock-gateway";
import {
  appRequest,
  form,
  sessionCookie,
  withMockGateway,
} from "@sneakers-web/mock-gateway/testing";

import { requireUser } from "#shell/server/session.server";
import { stepUpAction, type StepUpState } from "#shell/server/stepUp.server";

withMockGateway();

const post = async (cookie: string, fields: Record<string, string>) => {
  const request = appRequest("/resources/step-up", { body: form(fields), cookie, method: "POST" });
  try {
    const r = (await stepUpAction({ context: {}, params: {}, request } as never)) as unknown as {
      data: StepUpState;
    };
    return r.data;
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  }
};

describe("the step-up action", () => {
  it("refuses a wrong code, then accepts the right one so the vault sees a fresh factor", async () => {
    const cookie = sessionCookie("mock-user-alice");
    expect(await post(cookie, { code: "000000", intent: "verify", kind: "totp" })).toEqual({
      view: "prompt",
      wrong: true,
    });
    const ok = await post(cookie, { code: "481027", intent: "verify", kind: "totp" });
    expect(ok).toMatchObject({ view: "verified" });
  });

  it("treats a short code as wrong without asking the gateway", async () => {
    const cookie = sessionCookie("mock-user-alice");
    expect(await post(cookie, { code: "12", intent: "verify", kind: "totp" })).toEqual({
      view: "prompt",
      wrong: true,
    });
  });

  it("emails a code on request", async () => {
    const cookie = sessionCookie("mock-user-alice");
    expect(await post(cookie, { intent: "email" })).toEqual({
      emailState: "sent",
      view: "prompt",
    });
  });

  it("ends the session after five wrong proofs and sends the person to sign in", async () => {
    const cookie = sessionCookie("mock-user-alice");
    for (let index = 0; index < 4; index++) {
      expect(await post(cookie, { code: "000000", intent: "verify", kind: "totp" })).toMatchObject({
        wrong: true,
      });
    }
    const last = await post(cookie, { code: "000000", intent: "verify", kind: "totp" });
    expect(last).toBeInstanceOf(Response);
    expect((last as Response).headers.get("Location")).toBe("/sign-in?ended=1");
  });

  it("says the passkey step didn't work when the account has none", async () => {
    const cookie = sessionCookie("mock-user-alice");
    expect(await post(cookie, { intent: "passkey-begin" })).toEqual({
      problem: "passkey",
      view: "prompt",
    });
  });
});

describe("freshMfa in the mock", () => {
  it("is false until a step-up passes", async () => {
    const cookie = sessionCookie("mock-user-alice");
    const request = appRequest("/", { cookie });
    const { gw } = await requireUser(request);
    const probe = () =>
      new Request("https://mock-gateway.example.invalid/graphql", {
        headers: { Cookie: cookie, "X-CSRF-Token": (gw as unknown as { csrf: string }).csrf },
      });
    expect(freshMfa(probe())).toBe(false);
    await post(cookie, { code: "481027", intent: "verify", kind: "totp" });
    expect(freshMfa(probe())).toBe(true);
  });
});
