import { withMockGateway } from "@sneakers-web/mock-gateway/testing";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";

import { ResetPage } from "#shell/auth/ResetPage";
import { resetAction } from "#shell/server/signIn.server";

withMockGateway();

const Stub = createRoutesStub([
  { Component: () => <p>Sign-in page</p>, path: "/sign-in" },
  {
    action: resetAction as never,
    Component: ResetPage,
    HydrateFallback: () => null,
    path: "/sign-in/reset",
  },
]);

const toConfirm = async () => {
  const user = userEvent.setup();
  render(<Stub initialEntries={["/sign-in/reset"]} />);
  await user.type(await screen.findByLabelText("Email"), "alice@example.org");
  await user.click(screen.getByRole("button", { name: "Send reset code" }));
  await screen.findByRole("heading", { name: "Check your email" });
  return user;
};

describe("ResetPage", () => {
  it("asks for the email first and won't send without one", async () => {
    const user = userEvent.setup();
    render(<Stub initialEntries={["/sign-in/reset"]} />);
    await user.click(await screen.findByRole("button", { name: "Send reset code" }));
    expect(await screen.findByText("Enter the email on your account.")).toBeInTheDocument();
  });

  it("checks the new password on the server before calling the gateway", async () => {
    const user = await toConfirm();
    expect(screen.getByText(/We sent a code to a••••@example.org/)).toBeInTheDocument();
    await user.type(screen.getByLabelText("Code from the email"), "481027");
    await user.type(screen.getByLabelText("New password"), "short");
    await user.type(screen.getByLabelText("Confirm password"), "short");
    await user.click(screen.getByRole("button", { name: "Reset password" }));
    expect(
      await screen.findByText("Use at least 8 characters.", { selector: "[role=alert], span, p" }),
    ).toBeInTheDocument();
  });

  it("refuses a wrong code and sends a good reset back to sign-in", async () => {
    const user = await toConfirm();
    await user.type(screen.getByLabelText("Code from the email"), "000000");
    await user.type(screen.getByLabelText("New password"), "a long new password");
    await user.type(screen.getByLabelText("Confirm password"), "a long new password");
    await user.click(screen.getByRole("button", { name: "Reset password" }));
    expect(await screen.findByText("That code didn't work")).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Code from the email"));
    await user.type(screen.getByLabelText("Code from the email"), "481027");
    await user.type(screen.getByLabelText("New password"), "a long new password");
    await user.type(screen.getByLabelText("Confirm password"), "a long new password");
    await user.click(screen.getByRole("button", { name: "Reset password" }));
    expect(await screen.findByText("Sign-in page")).toBeInTheDocument();
  });
});
