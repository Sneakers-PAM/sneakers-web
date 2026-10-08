import { shortDate } from "@sneakers-web/ui";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { access } from "@/lib/osadmin/client";
import { OsadminError } from "@/lib/osadmin/errors";
import { setSession } from "@/lib/osadmin/sessionStore";
import { cancelStepUp, stepUpPending } from "@/lib/osadmin/stepUpController";
import { applyMockScenario, MOCK_PASSWORD, resetMockWorld } from "@/mock/edge.mock";
import * as world from "@/mock/world";
import Access from "@/routes/access";
import { renderPage } from "@/test/renderPage";
import { signInAs } from "@/test/session";

const signInAsOwner = () =>
  setSession({
    admin: "alice",
    csrfToken: "test-csrf",
    role: "ROLE_OWNER",
    stepUpUntil: new Date(Date.now() + 5 * 60_000).toISOString(),
  });

/** Simulate a screen of `widthPx`: every `min-width` media query answers for that width. */
const atWidth = (widthPx: number): (() => void) => {
  const original = globalThis.matchMedia;
  globalThis.matchMedia = ((query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    return {
      addEventListener: () => {},
      addListener: () => {},
      dispatchEvent: () => false,
      matches: min ? widthPx >= Number(min[1]) : false,
      media: query,
      onchange: null,
      removeEventListener: () => {},
      removeListener: () => {},
    };
  }) as typeof globalThis.matchMedia;
  return () => {
    globalThis.matchMedia = original;
  };
};

describe("Access", () => {
  // Every case but the phone-layout ones exercises the desktop table layout.
  let restoreWidth: () => void;
  beforeEach(() => {
    restoreWidth = atWidth(1440);
  });
  afterEach(() => {
    restoreWidth();
  });

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

  it("picks the root-operator roster from existing admins, not free text", async () => {
    signInAsOwner();
    renderPage(Access);
    await screen.findByRole("table", { name: "Admins" });
    expect(screen.queryByRole("textbox", { name: "Roster" })).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /alice/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /bob/ })).toBeChecked();
  });

  it("bounds required approvals between 2 and the number of picked members", async () => {
    signInAsOwner();
    renderPage(Access);
    await screen.findByRole("table", { name: "Admins" });
    const required = screen.getByRole("spinbutton", { name: "Approvals required" });
    expect(required).toHaveAttribute("min", "2");
    expect(required).toHaveAttribute("max", "2");
  });

  it("explains that a single-admin box can't factory reset", async () => {
    const bob = world.ADMINS.pop();
    try {
      resetMockWorld();
      signInAsOwner();
      renderPage(Access);
      await screen.findByRole("table", { name: "Admins" });
      expect(screen.getByText(/single-admin box can't factory reset/)).toBeInTheDocument();
    } finally {
      if (bob) world.ADMINS.push(bob);
    }
  });

  it("tells the owner when a removed admin was on the quorum roster, and updates it", async () => {
    signInAsOwner();
    const user = userEvent.setup();
    renderPage(Access);
    const admins = within(await screen.findByRole("table", { name: "Admins" }));
    const bobRow = within(admins.getByRole("row", { name: /bob/ }));
    await user.click(bobRow.getByRole("button", { name: "Remove admin" }));
    expect(
      await screen.findByText(/bob was removed from the root-operator roster/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /bob/ })).not.toBeInTheDocument();
  });

  it("shows your own Remove admin disabled, with why", async () => {
    signInAsOwner();
    renderPage(Access);
    const admins = within(await screen.findByRole("table", { name: "Admins" }));
    const remove = within(admins.getByRole("row", { name: /alice/ })).getByRole("button", {
      name: "Remove admin",
    });
    expect(remove).toBeDisabled();
    expect(remove).toHaveAccessibleDescription(
      "You can't remove your own account, and at least one owner must remain.",
    );
    const bobRemove = within(admins.getByRole("row", { name: /bob/ })).getByRole("button", {
      name: "Remove admin",
    });
    expect(bobRemove).toBeEnabled();
  });

  it("says another owner can remove you when there is one", async () => {
    world.ADMINS.push({ ...world.ADMINS[0]!, keys: [], name: "dana", uid: 20_009 });
    try {
      resetMockWorld();
      signInAsOwner();
      renderPage(Access);
      const admins = within(await screen.findByRole("table", { name: "Admins" }));
      const remove = within(admins.getByRole("row", { name: /alice/ })).getByRole("button", {
        name: "Remove admin",
      });
      expect(remove).toBeDisabled();
      expect(remove).toHaveAccessibleDescription(
        "You can't remove your own account. Another owner can.",
      );
      expect(
        within(admins.getByRole("row", { name: /dana/ })).getByRole("button", {
          name: "Remove admin",
        }),
      ).toBeEnabled();
    } finally {
      world.ADMINS.pop();
    }
  });

  it("shows the box's last-owner refusal in place, not only as a toast", async () => {
    vi.spyOn(access, "removeAdmin").mockRejectedValueOnce(
      new OsadminError(
        "failed_precondition",
        "ACCESS_LAST_OWNER (3104): the box must keep at least one owner",
      ),
    );
    signInAsOwner();
    const user = userEvent.setup();
    renderPage(Access);
    const admins = within(await screen.findByRole("table", { name: "Admins" }));
    await user.click(
      within(admins.getByRole("row", { name: /bob/ })).getByRole("button", {
        name: "Remove admin",
      }),
    );
    const refusal = await screen.findByRole("alert");
    expect(within(refusal).getByText("bob wasn't removed")).toBeInTheDocument();
    expect(within(refusal).getByText(/must keep at least one owner/)).toBeInTheDocument();
    expect(admins.getByText("bob")).toBeInTheDocument();
  });

  it("shows your own Remove admin disabled with why in the card's menu at phone width", async () => {
    const restore = atWidth(390);
    try {
      signInAsOwner();
      const user = userEvent.setup();
      renderPage(Access);
      await user.click(await screen.findByRole("button", { name: "Actions for alice" }));
      const item = screen.getByRole("menuitem", { name: /Remove admin/ });
      expect(item).toHaveAttribute("aria-disabled", "true");
      expect(item).toHaveTextContent("at least one owner must remain");
    } finally {
      restore();
    }
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

  it("stacks admins and revoked keys as cards at phone width, with no table", async () => {
    const restore = atWidth(390);
    try {
      signInAsOwner();
      renderPage(Access);
      await screen.findByRole("button", { name: "Actions for alice" });
      expect(screen.queryByRole("table", { name: "Admins" })).not.toBeInTheDocument();
      expect(screen.queryByRole("table", { name: "Revoked login keys" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Actions for bob" })).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Actions for SHA256:oLd9Q7h5z1s/ }),
      ).toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it("removes an admin's key from the card's actions menu at phone width", async () => {
    const restore = atWidth(390);
    try {
      signInAsOwner();
      const user = userEvent.setup();
      renderPage(Access);
      await screen.findByRole("button", { name: "Actions for bob" });
      await user.click(screen.getByRole("button", { name: "Actions for bob" }));
      await user.click(screen.getByRole("menuitem", { name: /Remove.*key/ }));
      await vi.waitFor(() =>
        expect(
          within(screen.getByRole("group", { name: "bob" })).queryByText(/SHA256:k2m9Q7h5z1s/),
        ).not.toBeInTheDocument(),
      );
    } finally {
      restore();
    }
  });

  it("un-revokes a key from the card's actions menu at phone width", async () => {
    const restore = atWidth(390);
    try {
      signInAs("alice");
      const user = userEvent.setup();
      renderPage(Access);
      await screen.findByRole("button", { name: /Actions for SHA256:oLd9Q7h5z1s/ });
      await user.click(screen.getByRole("button", { name: /Actions for SHA256:oLd9Q7h5z1s/ }));
      await user.click(screen.getByRole("menuitem", { name: "Un-revoke" }));
      const dialog = await screen.findByRole("dialog");
      await user.click(within(dialog).getByRole("button", { name: "Un-revoke key" }));
      expect(await screen.findByText("No revoked keys.")).toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it("shows each admin's role, root-operator badge and last sign-in", async () => {
    renderPage(Access);
    const admins = within(await screen.findByRole("table", { name: "Admins" }));
    const alice = within(admins.getByRole("row", { name: /alice/ }));
    expect(alice.getByText("owner")).toBeInTheDocument();
    expect(alice.getByText("root operator")).toBeInTheDocument();
    expect(alice.getByText("Active")).toBeInTheDocument();
  });

  it("shows a locked admin and lets an owner unlock them", async () => {
    applyMockScenario("locked");
    signInAsOwner();
    const user = userEvent.setup();
    renderPage(Access);
    const admins = within(await screen.findByRole("table", { name: "Admins" }));
    const bob = within(admins.getByRole("row", { name: /bob/ }));
    expect(bob.getByText(/Locked until \d{1,2}:\d{2}/)).toBeInTheDocument();
    await user.click(bob.getByRole("button", { name: "Unlock" }));
    expect(await bob.findByText("Active")).toBeInTheDocument();
  });

  it("adds an admin and shows the invitation code once", async () => {
    signInAsOwner();
    const user = userEvent.setup();
    renderPage(Access);
    const form = within(await screen.findByRole("form", { name: "Add an admin" }));
    await user.type(form.getByRole("textbox", { name: "Name" }), "carol");
    await user.click(form.getByRole("checkbox", { name: /root operator/ }));
    await user.click(form.getByRole("button", { name: "Add admin" }));
    const dialog = within(await screen.findByRole("dialog"));
    expect(dialog.getByText(/shown once/)).toBeInTheDocument();
    expect(dialog.getByLabelText("Invitation code for carol")).toHaveTextContent(
      /^[0-9A-Z]{4}-[0-9A-Z]{4}$/,
    );
    await user.click(dialog.getByRole("button", { name: "Done" }));
    const admins = within(screen.getByRole("table", { name: "Admins" }));
    const carol = within(admins.getByRole("row", { name: /carol/ }));
    expect(carol.getByText(/Invitation open until/)).toBeInTheDocument();
    expect(carol.getByText("root operator")).toBeInTheDocument();
  });

  it("re-invites an admin with a new code", async () => {
    signInAsOwner();
    const user = userEvent.setup();
    renderPage(Access);
    const admins = within(await screen.findByRole("table", { name: "Admins" }));
    await user.click(
      within(admins.getByRole("row", { name: /bob/ })).getByRole("button", { name: "Re-invite" }),
    );
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Re-invite bob" }),
    );
    expect(await screen.findByLabelText("Invitation code for bob")).toBeInTheDocument();
  });

  it("changes your own password after the current one", async () => {
    signInAsOwner();
    const user = userEvent.setup();
    renderPage(Access);
    const account = within(await screen.findByRole("region", { name: "Your account" }));
    await user.click(account.getByRole("button", { name: "Change password" }));
    const dialog = within(await screen.findByRole("dialog"));
    await user.type(dialog.getByLabelText("Current password"), MOCK_PASSWORD);
    await user.type(dialog.getByLabelText("New password"), "a brand new long passphrase");
    await user.type(dialog.getByLabelText("New password again"), "a brand new long passphrase");
    await dialog.findByText("Strong enough.");
    await user.click(dialog.getByRole("button", { name: "Change password" }));
    expect(await screen.findByText("Password changed.")).toBeInTheDocument();
  });

  it("replaces your authenticator with a QR code and a check code", async () => {
    signInAsOwner();
    const user = userEvent.setup();
    renderPage(Access);
    const account = within(await screen.findByRole("region", { name: "Your account" }));
    await user.click(account.getByRole("button", { name: "Replace authenticator" }));
    const dialog = within(await screen.findByRole("dialog"));
    expect(await dialog.findByTitle("QR code for your authenticator app")).toBeInTheDocument();
    await user.type(dialog.getByLabelText("6-digit code from the app"), "112233");
    await user.click(dialog.getByRole("button", { name: "Replace" }));
    expect(await screen.findByText("Authenticator replaced.")).toBeInTheDocument();
  });

  it("issues an SSH key and shows the private key once", async () => {
    signInAsOwner();
    const user = userEvent.setup();
    renderPage(Access);
    const account = within(await screen.findByRole("region", { name: "Your account" }));
    expect(account.getByText(/SSH asks for your TOTP code after login/)).toBeInTheDocument();
    await user.click(account.getByRole("button", { name: "Get an SSH key" }));
    const dialog = within(await screen.findByRole("dialog"));
    await user.type(dialog.getByLabelText("Label"), "work laptop");
    await user.click(dialog.getByRole("button", { name: "Make the key" }));
    expect(await dialog.findByText(/This is shown once/)).toBeInTheDocument();
    expect((dialog.getByLabelText("Private key") as HTMLTextAreaElement).value).toContain(
      "BEGIN OPENSSH PRIVATE KEY",
    );
    expect(dialog.getByRole("button", { name: /Download the private key/ })).toBeInTheDocument();
    expect(dialog.getByRole("button", { name: /Download the certificate/ })).toBeInTheDocument();
    await user.click(dialog.getByRole("button", { name: "I've saved it" }));
    expect(await account.findByText("work laptop")).toBeInTheDocument();
  });

  it("lets an owner set the access settings, with 10-minute root defaults", async () => {
    signInAsOwner();
    const user = userEvent.setup();
    renderPage(Access);
    const settings = within(await screen.findByRole("form", { name: "Access settings" }));
    expect(settings.getByLabelText("Root-shell code lifetime (minutes)")).toHaveValue("10");
    expect(settings.getByLabelText("Root-shell session limit (minutes)")).toHaveValue("10");
    expect(settings.getByLabelText("SSH key validity (days)")).toHaveValue("365");
    await user.click(settings.getByRole("radio", { name: "Until an owner unlocks it" }));
    const minutes = settings.getByLabelText("Root-shell code lifetime (minutes)");
    await user.clear(minutes);
    await user.type(minutes, "5");
    await user.click(settings.getByRole("button", { name: "Save access settings" }));
    expect(await screen.findByText("Access settings saved.")).toBeInTheDocument();
    const saved = await access.list();
    expect(saved.accessPolicy).toMatchObject({
      lockoutMode: "LOCKOUT_MODE_UNTIL_UNLOCKED",
      rootCodeMinutes: 5,
    });
  });

  it("hides the access settings from an admin who isn't an owner", async () => {
    signInAs("bob");
    renderPage(Access);
    await screen.findByRole("table", { name: "Admins" });
    expect(screen.queryByRole("form", { name: "Access settings" })).not.toBeInTheDocument();
  });

  it("shows the root key's fingerprint next to the host keys", async () => {
    renderPage(Access);
    expect(await screen.findByText(/Root key ssh-ed25519 SHA256:/)).toBeInTheDocument();
  });

  it("lists the root shells, and an owner can end an open one", async () => {
    applyMockScenario("elevated");
    signInAsOwner();
    const user = userEvent.setup();
    renderPage(Access);
    const shells = within(await screen.findByRole("table", { name: "Root shells" }));
    const open = within(shells.getByRole("row", { name: /E-9M4T/ }));
    await user.click(open.getByRole("button", { name: "End" }));
    expect(await open.findByText("ended")).toBeInTheDocument();
  });
});
