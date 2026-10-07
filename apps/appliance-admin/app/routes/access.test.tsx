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

  it("picks the factory-reset quorum roster from existing admins, not free text", async () => {
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
      await screen.findByText(/bob was removed from the factory-reset quorum roster/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /bob/ })).not.toBeInTheDocument();
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
});
