import { render, screen } from "@testing-library/react";
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
      keyFingerprint: "SHA256:test",
      role: "ROLE_OWNER",
    });
    stub("/home");
    expect(await screen.findByText("Status page")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Account: alice/ })).toBeInTheDocument();
  });
});
