import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";

import { getSession, setSession } from "@/lib/osadmin/sessionStore";
import { applyMockScenario, MOCK_PASSWORD } from "@/mock/edge.mock";
import SignIn from "@/routes/sign-in";
import { renderPage } from "@/test/renderPage";

const renderWithHome = () => {
  const Stub = createRoutesStub([
    { Component: SignIn, path: "/" },
    { Component: () => <p>Home page</p>, path: "/home" },
  ]);
  return render(<Stub initialEntries={["/"]} />);
};

const fill = async (
  user: ReturnType<typeof userEvent.setup>,
  admin: string,
  password: string,
  code: string,
) => {
  await user.type(screen.getByLabelText("Admin name"), admin);
  await user.type(screen.getByLabelText("Password"), password);
  await user.type(screen.getByLabelText("Authenticator code"), code);
  await user.click(screen.getByRole("button", { name: "Sign in" }));
};

describe("SignIn", () => {
  it("asks for the name, the password and an authenticator code, with no SSH code", () => {
    renderPage(SignIn);
    expect(screen.getByLabelText("Admin name")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
    expect(screen.getByLabelText("Authenticator code")).toBeInTheDocument();
    expect(screen.queryByText(/ssh <you>@/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "How does sign-in work?" }),
    ).not.toBeInTheDocument();
  });

  it("shows and hides the password", async () => {
    const user = userEvent.setup();
    renderPage(SignIn);
    await user.click(screen.getByRole("button", { name: "Show the password" }));
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text");
  });

  it("signs in and goes to /home", async () => {
    const user = userEvent.setup();
    renderWithHome();
    await fill(user, "alice", MOCK_PASSWORD, "123456");
    expect(await screen.findByText("Home page")).toBeInTheDocument();
    expect(getSession()?.admin).toBe("alice");
  });

  it("says how many tries are left after a wrong try, and clears the password and code", async () => {
    const user = userEvent.setup();
    renderPage(SignIn);
    await fill(user, "alice", "not the password", "123456");
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(/2 tries left before the account locks/)).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toHaveValue("");
    expect(screen.getByLabelText("Authenticator code")).toHaveValue("");
    expect(screen.getByLabelText("Admin name")).toHaveValue("alice");
  });

  it("says until when a locked account stays locked", async () => {
    applyMockScenario("locked");
    const user = userEvent.setup();
    renderPage(SignIn);
    await fill(user, "bob", MOCK_PASSWORD, "123456");
    expect(await screen.findByText(/bob is locked until \d{1,2}:\d{2}/)).toBeInTheDocument();
  });

  it("says when only an owner can unlock the account", async () => {
    applyMockScenario("locked-until-unlocked");
    const user = userEvent.setup();
    renderPage(SignIn);
    await fill(user, "bob", MOCK_PASSWORD, "123456");
    expect(await screen.findByText(/locked until an owner unlocks it/)).toBeInTheDocument();
  });

  it("says when this address has to wait", async () => {
    applyMockScenario("throttled");
    const user = userEvent.setup();
    renderPage(SignIn);
    await fill(user, "alice", MOCK_PASSWORD, "123456");
    expect(await screen.findByText(/Too many tries from this address/)).toBeInTheDocument();
  });

  it("explains the sign-in in a short help dialog", async () => {
    const user = userEvent.setup();
    renderPage(SignIn);
    await user.click(screen.getByRole("button", { name: "Help with signing in" }));
    const dialog = within(await screen.findByRole("dialog"));
    expect(dialog.getByText(/authenticator app/)).toBeInTheDocument();
    expect(dialog.getByText(/SSH asks for your TOTP code after login/)).toBeInTheDocument();
    expect(dialog.getByText(/Recover access on the appliance's console/)).toBeInTheDocument();
  });

  it("links to setup for a setup or invitation code", () => {
    renderPage(SignIn);
    expect(screen.getByRole("link", { name: /Enter a setup or invitation code/ })).toHaveAttribute(
      "href",
      "/setup",
    );
  });

  it("signs in as a fixture admin from the dev quick login", async () => {
    const user = userEvent.setup();
    renderPage(SignIn);
    await user.click(screen.getByRole("combobox", { name: /Dev quick login/ }));
    await user.click(screen.getByRole("option", { name: /alice/ }));
    expect(getSession()?.admin).toBe("alice");
  });

  it("sends an already signed-in admin straight to /home", async () => {
    setSession({ admin: "alice", csrfToken: "test-csrf", role: "ROLE_OWNER" });
    renderWithHome();
    expect(await screen.findByText("Home page")).toBeInTheDocument();
  });
});
