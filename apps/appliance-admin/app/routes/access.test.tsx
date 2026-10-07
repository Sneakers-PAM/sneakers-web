import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { setSession } from "@/lib/osadmin/sessionStore";
import Access from "@/routes/access";
import { renderPage } from "@/test/renderPage";

const signInAsOwner = () =>
  setSession({
    admin: "alice",
    csrfToken: "test-csrf",
    keyFingerprint: "SHA256:test",
    role: "ROLE_OWNER",
    stepUpUntil: new Date(Date.now() + 5 * 60_000).toISOString(),
  });

describe("Access", () => {
  it("lists the admins and their keys", async () => {
    renderPage(Access);
    const admins = within(await screen.findByRole("table", { name: "Admins" }));
    expect(admins.getByText("alice")).toBeInTheDocument();
    expect(admins.getByText("bob")).toBeInTheDocument();
  });

  it("lets an owner remove an admin's key", async () => {
    signInAsOwner();
    const user = userEvent.setup();
    renderPage(Access);
    const admins = within(await screen.findByRole("table", { name: "Admins" }));
    const bobRow = within(admins.getByRole("row", { name: /bob/ }));
    await user.click(bobRow.getByRole("button", { name: "Remove" }));
    expect(bobRow.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
  });

  it("lets an owner approve a pending elevation request", async () => {
    signInAsOwner();
    const user = userEvent.setup();
    renderPage(Access);
    const elevations = within(
      await screen.findByRole("table", { name: "Shell elevation requests" }),
    );
    expect(elevations.getByText("investigate kubelet")).toBeInTheDocument();
    await user.click(elevations.getByRole("button", { name: "Approve" }));
    expect(await elevations.findByText("approved")).toBeInTheDocument();
  });
});
