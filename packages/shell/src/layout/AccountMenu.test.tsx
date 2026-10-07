import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";

import { AccountMenu } from "#shell/layout/AccountMenu";

const stub = (about?: Parameters<typeof AccountMenu>[0]["renderAbout"]) =>
  createRoutesStub([
    {
      Component: () => (
        <AccountMenu
          app="staff"
          email="alice@example.org"
          name="alice"
          onSignOut={() => {}}
          renderAbout={about}
        />
      ),
      path: "/",
    },
  ]);

describe("AccountMenu", () => {
  it("opens the default About and diagnostics dialog when no override is given", async () => {
    const user = userEvent.setup();
    const Stub = stub();
    render(<Stub initialEntries={["/"]} />);
    await user.click(screen.getByRole("button", { name: "Account: alice" }));
    await user.click(await screen.findByText("About and diagnostics"));
    expect(
      await screen.findByText(
        "The versions of this app and everything behind it. Copy them into a support request.",
      ),
    ).toBeInTheDocument();
  });

  it("opens the given renderAbout dialog instead of the default one", async () => {
    const user = userEvent.setup();
    const Stub = stub(({ open }) => (
      <div data-testid="custom-about">{open ? "custom about is open" : "closed"}</div>
    ));
    render(<Stub initialEntries={["/"]} />);
    await user.click(screen.getByRole("button", { name: "Account: alice" }));
    await user.click(await screen.findByText("About and diagnostics"));
    expect(await screen.findByText("custom about is open")).toBeInTheDocument();
    expect(
      screen.queryByText(
        "The versions of this app and everything behind it. Copy them into a support request.",
      ),
    ).not.toBeInTheDocument();
  });
});
