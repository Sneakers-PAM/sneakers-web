import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";

import { getSession, setSession } from "@/lib/osadmin/sessionStore";
import SignIn from "@/routes/sign-in";
import { renderPage } from "@/test/renderPage";

describe("SignIn", () => {
  it("shows the code and the ssh instruction", async () => {
    renderPage(SignIn);
    expect(await screen.findByText("ABCD-1234")).toBeInTheDocument();
    expect(screen.getByText(/login ABCD-1234/)).toBeInTheDocument();
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
