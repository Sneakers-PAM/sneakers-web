import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { backup, rootKey, setup } from "@/lib/osadmin/client";
import { OsadminError } from "@/lib/osadmin/errors";
import Backups from "@/routes/backups";
import { renderPage } from "@/test/renderPage";
import { signInAs } from "@/test/session";

describe("Backups", () => {
  it("shows the policy and the backup sets", async () => {
    renderPage(Backups);
    expect(await screen.findByText("Backups")).toBeInTheDocument();
    expect(screen.getByDisplayValue("02:00")).toBeInTheDocument();
    expect(screen.getByText("bk-20261006")).toBeInTheDocument();
  });

  it("says it isn't available when the box's backup backend isn't there", async () => {
    vi.spyOn(backup, "get").mockRejectedValueOnce(
      new OsadminError("unimplemented", "BackupService isn't on this box"),
    );
    renderPage(Backups);
    expect(await screen.findByText("Backups: not available in this release")).toBeInTheDocument();
  });

  it("runs a backup now and adds a new set", async () => {
    const user = userEvent.setup();
    renderPage(Backups);
    await screen.findByText("Backups");
    const before = screen.getAllByText(/^bk-/).length;
    await user.click(screen.getByRole("button", { name: "Run now" }));
    await screen.findByText("Backups");
    expect(await screen.findAllByText(/^bk-/)).toHaveLength(before + 1);
  });

  it("downloads the escrow from the recovery keys card, after setup too", async () => {
    const user = userEvent.setup();
    const escrow = vi.spyOn(setup, "downloadEscrow");
    signInAs("alice");
    renderPage(Backups);
    await user.click(await screen.findByRole("button", { name: "Download the escrow" }));
    await vi.waitFor(() => expect(escrow).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/carries .* keys/)).toBeInTheDocument();
  });

  it("offers the escrow download to owners only", async () => {
    signInAs("bob");
    renderPage(Backups);
    await screen.findByText("Recovery keys");
    expect(screen.queryByRole("button", { name: "Download the escrow" })).not.toBeInTheDocument();
  });

  it("wraps a recovery key's fingerprint instead of letting it run off the card", async () => {
    signInAs("alice");
    renderPage(Backups);
    const fingerprint = await screen.findByText(
      (_, element) =>
        element?.tagName === "SPAN" &&
        element.textContent === "SHA256:rK1X8qf9w2v6z4m7h5s1rQwQEuY7zL5mZ8w5z6c1h9",
    );
    expect(fingerprint.className).toContain("wrap-anywhere");
  });

  describe("the vault root key", () => {
    it("shows an owner that the root key hasn't been rotated, with a button to rotate it", async () => {
      signInAs("alice");
      renderPage(Backups);
      const card = within(await screen.findByRole("region", { name: "Vault root key" }));
      expect(card.getByText("The root key hasn't been rotated on this box.")).toBeInTheDocument();
      expect(card.getByRole("button", { name: "Rotate root key" })).toBeInTheDocument();
    });

    it("asks first, says what happens to an older escrow, then follows the rotation to done", async () => {
      const user = userEvent.setup();
      signInAs("alice");
      renderPage(Backups);
      const card = within(await screen.findByRole("region", { name: "Vault root key" }));
      await user.click(card.getByRole("button", { name: "Rotate root key" }));
      const dialog = await screen.findByRole("alertdialog", { name: "Rotate the vault root key?" });
      expect(
        within(dialog).getByText(/older escrow no longer opens the vault/),
      ).toBeInTheDocument();
      await user.click(within(dialog).getByRole("button", { name: "Rotate root key" }));
      expect(await card.findByText(/Rotating the root key/)).toBeInTheDocument();
      expect(
        await card.findByText(
          /The root key was rotated\. Download a new escrow/,
          {},
          { timeout: 5000 },
        ),
      ).toBeInTheDocument();
    });

    it("leaves the rotation alone when the owner cancels", async () => {
      const user = userEvent.setup();
      const rotate = vi.spyOn(rootKey, "rotate");
      signInAs("alice");
      renderPage(Backups);
      const card = within(await screen.findByRole("region", { name: "Vault root key" }));
      await user.click(card.getByRole("button", { name: "Rotate root key" }));
      await user.click(
        within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Cancel" }),
      );
      expect(rotate).not.toHaveBeenCalled();
    });

    it("says why a rotation stopped and offers to carry on", async () => {
      vi.spyOn(rootKey, "get").mockResolvedValue({
        available: true,
        state: "stopped",
        step: "checking the working keys",
        why: "the vault didn't answer",
      });
      signInAs("alice");
      renderPage(Backups);
      const card = within(await screen.findByRole("region", { name: "Vault root key" }));
      expect(card.getByText(/stopped at checking the working keys/)).toBeInTheDocument();
      expect(card.getByText(/the vault didn't answer/)).toBeInTheDocument();
      expect(card.getByRole("button", { name: "Carry on rotating" })).toBeInTheDocument();
    });

    it("says so, with no button, when the installed product can't rotate its root key", async () => {
      vi.spyOn(rootKey, "get").mockResolvedValue({
        available: false,
        state: "none",
        step: "",
        why: "",
      });
      signInAs("alice");
      renderPage(Backups);
      const card = within(await screen.findByRole("region", { name: "Vault root key" }));
      expect(card.getByText(/can't rotate its root key/)).toBeInTheDocument();
      expect(card.queryByRole("button")).not.toBeInTheDocument();
    });

    it("shows the card to owners only", async () => {
      signInAs("bob");
      renderPage(Backups);
      await screen.findByText("Recovery keys");
      expect(screen.queryByRole("region", { name: "Vault root key" })).not.toBeInTheDocument();
    });
  });
});
