import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";

import { SignInPage } from "#shell/auth/SignInPage";
import { signInAction, signInLoader } from "#shell/server/signIn.server";
import { withMockGateway } from "#shell/test/mockGateway";

withMockGateway();

const Stub = createRoutesStub([
  {
    action: signInAction as never,
    Component: SignInPage,
    HydrateFallback: () => null,
    loader: signInLoader as never,
    path: "/sign-in",
  },
]);

const open = async (url = "/sign-in?view=local") => {
  render(<Stub initialEntries={[url]} />);
  return screen.findByRole("heading", { name: /local login|sign in to continue/i });
};

describe("SignInPage", () => {
  it("offers single sign-on first, with a way to the local form", async () => {
    await open("/sign-in");
    expect(screen.getByRole("button", { name: "Sign in with SSO" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Use local login instead" })).toHaveAttribute(
      "href",
      expect.stringContaining("view=local"),
    );
  });

  it("walks Alice through her password, a wrong code and the right one", async () => {
    const user = userEvent.setup();
    await open();
    await user.type(screen.getByLabelText("Username or email"), "alice");
    await user.type(screen.getByLabelText("Password"), "any password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    const code = await screen.findByLabelText("6-digit code");
    expect(screen.getByRole("radio", { name: "Authenticator" })).toBeChecked();
    await user.type(code, "000000");
    expect(await screen.findByText(/That code didn.t work/)).toBeInTheDocument();

    expect(screen.getByLabelText("6-digit code")).toHaveValue("000000");
    await user.clear(screen.getByLabelText("6-digit code"));
    expect(screen.queryByText(/That code didn.t work/)).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("6-digit code"), "481027");
    expect(await screen.findByText("Welcome back, Alice")).toBeInTheDocument();
  });

  it("says what went wrong with the password, plainly", async () => {
    const user = userEvent.setup();
    await open();
    await user.type(screen.getByLabelText("Username or email"), "alice");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Both fields are needed.");
  });

  it("shows the session-ended notice after the gateway signs someone out", async () => {
    render(<Stub initialEntries={["/sign-in?ended=1"]} />);
    expect(await screen.findByText("You were signed out")).toBeInTheDocument();
  });

  it("sends the email code when Email is picked and says where it went", async () => {
    const user = userEvent.setup();
    await open();
    await user.type(screen.getByLabelText("Username or email"), "alice@example.org");
    await user.type(screen.getByLabelText("Password"), "x");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await user.click(await screen.findByRole("radio", { name: "Email" }));
    expect(await screen.findByText(/We emailed a code to a••••@example.org/)).toBeInTheDocument();
  });
});
