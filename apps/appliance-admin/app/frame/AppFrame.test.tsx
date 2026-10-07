import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";

import { AppFrame } from "@/frame/AppFrame";
import { setSession } from "@/lib/osadmin/sessionStore";

const stub = (start: string) => {
  const Stub = createRoutesStub([
    { Component: () => <p>Sign-in page</p>, path: "/" },
    {
      children: [{ Component: () => <p>Status page</p>, path: "home" }],
      Component: AppFrame,
    },
  ]);
  return render(<Stub initialEntries={[start]} />);
};

describe("AppFrame", () => {
  it("sends a signed-out visitor to sign-in", async () => {
    setSession(null);
    stub("/home");
    expect(await screen.findByText("Sign-in page")).toBeInTheDocument();
  });

  it("shows the page and the account menu once signed in", async () => {
    setSession({
      admin: "alice",
      csrfToken: "test-csrf",
      role: "ROLE_OWNER",
    });
    stub("/home");
    expect(await screen.findByText("Status page")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Account: alice/ })).toBeInTheDocument();
  });

  it("opens the appliance's own About and diagnostics, not the gateway-shaped one", async () => {
    setSession({
      admin: "alice",
      csrfToken: "test-csrf",
      role: "ROLE_OWNER",
    });
    const user = userEvent.setup();
    stub("/home");
    await screen.findByText("Status page");
    await user.click(screen.getByRole("button", { name: /Account: alice/ }));
    await user.click(await screen.findByText("About and diagnostics"));
    expect(
      await screen.findByText(`appliance-admin ${__APP_VERSION__} (${__APP_COMMIT__})`),
    ).toBeInTheDocument();
    expect(screen.getByText("alice (owner)")).toBeInTheDocument();
    expect(screen.queryByText(/gateway/i)).not.toBeInTheDocument();
  });

  it("tells the admin the box's notices after signing in", async () => {
    setSession({
      admin: "alice",
      csrfToken: "test-csrf",
      notices: ["Recover access was used on the console at 14:03."],
      role: "ROLE_OWNER",
    });
    stub("/home");
    expect(
      await screen.findByText("Recover access was used on the console at 14:03."),
    ).toBeInTheDocument();
  });
});
