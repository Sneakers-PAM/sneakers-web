import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { backup, setup } from "@/lib/osadmin/client";
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
      /SHA256:rK1X8qf9w2v6z4m7h5s1rQwQEuY7zL5mZ8w5z6c1h9/,
    );
    expect(fingerprint.className).toContain("break-all");
  });
});
