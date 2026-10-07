import { shortDate } from "@sneakers-web/ui";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { access } from "@/lib/osadmin/client";
import { OsadminError } from "@/lib/osadmin/errors";
import { setSession } from "@/lib/osadmin/sessionStore";
import { cancelStepUp, stepUpPending } from "@/lib/osadmin/stepUpController";
import { applyMockScenario, resetMockWorld } from "@/mock/edge.mock";
import * as world from "@/mock/world";
import Access from "@/routes/access";
import { renderPage } from "@/test/renderPage";
import { signInAs } from "@/test/session";

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

  it("lists each admin's revoked keys with the fingerprint, type, when and who revoked it", async () => {
    renderPage(Access);
    const revoked = within(await screen.findByRole("table", { name: "Revoked login keys" }));
    expect(revoked.getByRole("columnheader", { name: "Revoked by" })).toBeInTheDocument();
    const row = within(revoked.getByRole("row", { name: /SHA256:oLd9Q7h5z1s/ }));
    expect(row.getByText("bob")).toBeInTheDocument();
    expect(row.getByText("alice")).toBeInTheDocument();
    expect(row.getByText("ssh-ed25519")).toBeInTheDocument();
    expect(row.getByText(shortDate(world.REVOKED_KEYS[0]?.revoked ?? ""))).toBeInTheDocument();
  });

  it("lets an owner un-revoke a key after a confirmation", async () => {
    signInAs("alice");
    const user = userEvent.setup();
    renderPage(Access);
    const revoked = within(await screen.findByRole("table", { name: "Revoked login keys" }));
    await user.click(revoked.getByRole("button", { name: "Un-revoke" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/SHA256:oLd9Q7h5z1s/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Un-revoke key" }));
    expect(await screen.findByText("No revoked keys.")).toBeInTheDocument();
  });

  it("asks for a fresh sign-in when un-revoking needs a step-up", async () => {
    signInAs("alice");
    applyMockScenario("stepup");
    const user = userEvent.setup();
    renderPage(Access);
    const revoked = within(await screen.findByRole("table", { name: "Revoked login keys" }));
    await user.click(revoked.getByRole("button", { name: "Un-revoke" }));
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Un-revoke key" }),
    );
    await vi.waitFor(() => expect(stepUpPending()).toBe(true));
    cancelStepUp();
  });

  it("shows the box's refusal in the dialog and keeps the key listed", async () => {
    signInAs("alice");
    vi.spyOn(access, "unrevokeKey").mockRejectedValueOnce(
      new OsadminError("invalid_argument", "ACCESS_KEY_TYPE: key SHA256:oLd9 isn't revoked"),
    );
    const user = userEvent.setup();
    renderPage(Access);
    const revoked = within(await screen.findByRole("table", { name: "Revoked login keys" }));
    await user.click(revoked.getByRole("button", { name: "Un-revoke" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Un-revoke key" }));
    expect(await within(dialog).findByText(/ACCESS_KEY_TYPE/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(revoked.getByRole("row", { name: /SHA256:oLd9Q7h5z1s/ })).toBeInTheDocument();
  });

  it("gives the add-admin Name field most of the row and labels the narrow Role control", async () => {
    signInAsOwner();
    renderPage(Access);
    const form = within(await screen.findByRole("form", { name: "Add an admin" }));
    expect(form.getByText("Role")).toBeInTheDocument();
    expect(form.getByRole("textbox", { name: "Name" })).toBeInTheDocument();
    expect(form.getByRole("combobox", { name: "Role" })).toBeInTheDocument();
  });

  it("labels the Admin control on the add-a-login-key row", async () => {
    renderPage(Access);
    const group = within(await screen.findByRole("group", { name: "Add a login key" }));
    expect(group.getByRole("combobox", { name: "Admin" })).toBeInTheDocument();
  });

  it("shows other roles the revoked keys but no un-revoke", async () => {
    signInAs("bob");
    renderPage(Access);
    const revoked = within(await screen.findByRole("table", { name: "Revoked login keys" }));
    expect(revoked.getByRole("row", { name: /SHA256:oLd9Q7h5z1s/ })).toBeInTheDocument();
    expect(revoked.queryByRole("button", { name: "Un-revoke" })).not.toBeInTheDocument();
    await expect(
      access.unrevokeKey("SHA256:oLd9Q7h5z1sRkYwQwQEuY7zL5mZ8w5z6c1h9b7qOLD"),
    ).rejects.toThrow(/ACCESS_FORBIDDEN/);
  });

  it("lists a removed key as revoked", async () => {
    signInAs("alice");
    const user = userEvent.setup();
    renderPage(Access);
    const admins = within(await screen.findByRole("table", { name: "Admins" }));
    await user.click(
      within(admins.getByRole("row", { name: /bob/ })).getByRole("button", { name: "Remove" }),
    );
    const revoked = within(screen.getByRole("table", { name: "Revoked login keys" }));
    const row = within(await revoked.findByRole("row", { name: /SHA256:k2m9Q7h5z1s/ }));
    expect(row.getByText("alice")).toBeInTheDocument();
  });

  it("shows unknown for a key revoked before the appliance recorded who did it", async () => {
    world.REVOKED_KEYS.push({
      admin: "bob",
      fingerprint: "SHA256:oLderNoActor",
      type: "ssh-ed25519",
    });
    try {
      resetMockWorld();
      renderPage(Access);
      const revoked = within(await screen.findByRole("table", { name: "Revoked login keys" }));
      const row = within(revoked.getByRole("row", { name: /SHA256:oLderNoActor/ }));
      expect(row.getByText("unknown")).toBeInTheDocument();
    } finally {
      world.REVOKED_KEYS.pop();
    }
  });
});
