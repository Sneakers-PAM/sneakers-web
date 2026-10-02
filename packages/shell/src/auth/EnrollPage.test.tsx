import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";

import { EnrollPage } from "#shell/auth/EnrollPage";
import { enrollAction, enrollLoader } from "#shell/server/enroll.server";
import { signInAction } from "#shell/server/signIn.server";
import { appRequest, cookieFrom, form, withMockGateway } from "#shell/test/mockGateway";

withMockGateway();

/** Bob has no factor and MFA is optional for him, so enrolment can be skipped. */
const bobCookie = async () => {
  const request = appRequest("/sign-in", {
    body: form({ identifier: "bob", intent: "login", next: "/", password: "any" }),
    method: "POST",
  });
  const r = (await signInAction({ context: {}, params: {}, request } as never)) as unknown as {
    init: { headers: HeadersInit };
  };
  return cookieFrom(new Headers(r.init.headers));
};

const withCookie =
  (cookie: string, run: (arguments_: { request: Request }) => Promise<unknown>) =>
  ({ request }: { request: Request }) => {
    const headers = new Headers(request.headers);
    headers.set("Cookie", cookie);
    return run({ ...({} as object), request: new Request(request, { headers }) } as never);
  };

describe("EnrollPage", () => {
  it("says a wrong code didn't match, then lets the person try again", async () => {
    const cookie = await bobCookie();
    const Stub = createRoutesStub([
      {
        action: withCookie(cookie, (a) =>
          enrollAction({ context: {}, params: {}, ...a } as never),
        ) as never,
        Component: EnrollPage,
        HydrateFallback: () => null,
        loader: withCookie(cookie, (a) =>
          enrollLoader({ context: {}, params: {}, ...a } as never),
        ) as never,
        path: "/enroll",
      },
    ]);
    const user = userEvent.setup();
    render(<Stub initialEntries={["/enroll"]} />);
    expect(
      await screen.findByRole("heading", { name: "Protect your account" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Skip for now" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("6-digit code"), "000000");
    expect(await screen.findByText(/That code didn.t match/)).toBeInTheDocument();
    // As in frame 13f: the wrong digits stay, marked invalid, until the person edits them.
    const input = screen.getByLabelText("6-digit code");
    expect(input).toHaveValue("000000");
    expect(input).toHaveAttribute("aria-invalid", "true");
    await user.type(input, "{Backspace}");
    expect(screen.queryByText(/That code didn.t match/)).not.toBeInTheDocument();
  });
});
