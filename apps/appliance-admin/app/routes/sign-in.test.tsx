import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";

import { getSession, setSession } from "@/lib/osadmin/sessionStore";
import SignIn from "@/routes/sign-in";
import { renderPage } from "@/test/renderPage";

describe("SignIn", () => {
  it("shows only the code and the exact ssh command, with a copy button", async () => {
    renderPage(SignIn);
    expect(await screen.findByText("ABCD-1234")).toBeInTheDocument();
    expect(screen.getByText("ssh <you>@192.0.2.10 login ABCD-1234")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
    // The full explanation lives in the dialog, not inline on the page.
    expect(screen.queryByText(/approve the sign-in shown as/)).not.toBeInTheDocument();
  });

  it("copies the exact ssh command", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    renderPage(SignIn);
    await screen.findByText("ABCD-1234");
    await user.click(screen.getByRole("button", { name: "Copy" }));
    expect(writeText).toHaveBeenCalledWith("ssh <you>@192.0.2.10 login ABCD-1234");
  });

  it("explains SSH-attested sign-in in a dialog, not inline", async () => {
    const user = userEvent.setup();
    renderPage(SignIn);
    await screen.findByText("ABCD-1234");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "How does sign-in work?" }));
    const dialog = within(await screen.findByRole("dialog"));
    expect(dialog.getByText(/valid for 5 minutes and works once/)).toBeInTheDocument();
    expect(dialog.getAllByText(/login ABCD-1234/)).toHaveLength(2);
    expect(dialog.getByText(/in the closed shell/)).toBeInTheDocument();
    expect(dialog.getByText(/can be a hardware key/)).toBeInTheDocument();
    expect(dialog.getByText(/browser address and agent/)).toBeInTheDocument();
    expect(dialog.getByText(/signs in by itself/)).toBeInTheDocument();
    expect(dialog.getByText(/no passwords on this box/)).toBeInTheDocument();
    expect(dialog.getByText(/15 minutes idle or 8 hours/)).toBeInTheDocument();
    expect(dialog.getByText(/removing your key ends your sessions/i)).toBeInTheDocument();
    expect(dialog.getByRole("link", { name: "Recover access" })).toBeInTheDocument();
  });

  it("signs in as a fixture admin from the dev quick login", async () => {
    const user = userEvent.setup();
    renderPage(SignIn);
    await screen.findByText("ABCD-1234");
    await user.click(screen.getByRole("combobox", { name: /Dev quick login/ }));
    await user.click(screen.getByRole("option", { name: /alice/ }));
    expect(getSession()?.admin).toBe("alice");
  });

  it("sends an already signed-in admin straight to /home", async () => {
    setSession({
      admin: "alice",
      csrfToken: "test-csrf",
      keyFingerprint: "SHA256:test",
      role: "ROLE_OWNER",
    });
    const Stub = createRoutesStub([
      { Component: SignIn, path: "/" },
      { Component: () => <p>Home page</p>, path: "/home" },
    ]);
    render(<Stub initialEntries={["/"]} />);
    expect(await screen.findByText("Home page")).toBeInTheDocument();
  });
});
