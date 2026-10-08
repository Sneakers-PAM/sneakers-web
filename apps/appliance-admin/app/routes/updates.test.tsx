import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { elevation, upgrade } from "@/lib/osadmin/client";
import { OsadminError } from "@/lib/osadmin/errors";
import { cancelStepUp, resumeStepUp, stepUpPending } from "@/lib/osadmin/stepUpController";
import { applyMockScenario } from "@/mock/edge.mock";
import Updates from "@/routes/updates";
import { renderPage } from "@/test/renderPage";
import { signInAs } from "@/test/session";

const binFile = (content: string, name = "sneakers-appliance-0.2.0-amd64.bin") =>
  new File([content], name, { type: "application/octet-stream" });

const openPage = async () => {
  renderPage(Updates);
  return screen.findByRole("heading", { name: "Updates" });
};

const panel = () => screen.findByRole("region", { name: "Verify result" });

const uploadAndVerify = async (user: ReturnType<typeof userEvent.setup>, file: File) => {
  await user.upload(screen.getByLabelText("Update .bin file"), file);
  await user.click(screen.getByRole("button", { name: "Upload" }));
  await user.click(await screen.findByRole("button", { name: "Verify and stage" }));
};

/** The paragraph whose whole text is `text`, even when a version chip splits it up. */
const line = (text: RegExp | string) =>
  screen.getByText(
    (_, element) =>
      element?.tagName === "P" &&
      (typeof text === "string" ? element.textContent === text : text.test(element.textContent)),
  );

describe("Updates", () => {
  beforeEach(() => signInAs("alice"));

  it("shows the running version, the other slot, the update window and the history", async () => {
    await openPage();
    const running = within(line("Running 0.1.0 in the active slot")).getByText("0.1.0");
    expect(running).toHaveAttribute("data-version", "running");
    expect(running).toHaveClass("bg-primary-soft", "text-primary");
    expect(screen.getByText("Other slot: 0.0.9 (revert target)")).toBeInTheDocument();
    expect(screen.getByText(/Daily at 02:00 for 120 minutes/)).toBeInTheDocument();
    const history = screen.getByRole("table", { name: "Update history" });
    expect(within(history).getAllByRole("row").length).toBeGreaterThan(1);
  });

  it("shows a staged base release in a quieter tone than the running one", async () => {
    applyMockScenario("staged");
    await openPage();
    const staged = within(line("Other slot: staged 0.2.0")).getByText("0.2.0");
    expect(staged).toHaveAttribute("data-version", "staged");
    expect(staged).toHaveClass("bg-neutral-soft");
    expect(staged).not.toHaveClass("bg-primary-soft");
  });

  it("uploads a .bin, then shows the verified signature, channel and hash before it stages", async () => {
    const user = userEvent.setup();
    await openPage();
    await user.upload(screen.getByLabelText("Update .bin file"), binFile("signed release"));
    await user.click(screen.getByRole("button", { name: "Upload" }));
    expect(
      await screen.findByText(/Uploaded sneakers-appliance-0.2.0-amd64.bin/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Signature: verified/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Verify and stage" }));
    const result = await screen.findByRole("region", { name: "Verify result" });
    expect(within(result).getByText("Verified")).toBeInTheDocument();
    const terms = within(result)
      .getAllByRole("term")
      .map((term) => term.textContent);
    expect(terms).toEqual([
      "File",
      "Version",
      "Architecture",
      "Signature",
      "Channel",
      "SHA-256",
      "Staged",
    ]);
    const values = within(result)
      .getAllByRole("definition")
      .map((value) => value.textContent);
    expect(values[0]).toBe("sneakers-appliance-0.2.0-amd64.bin");
    expect(values[1]).toBe("full release 0.2.0");
    expect(values[2]).toBe("amd64");
    expect(values[3]).toBe("Verified against this appliance's release key");
    expect(values[4]).toBe("stable");
    expect(values[5]).toMatch(/^[0-9a-f]{64}Copy$/);
    expect(values[6]).toBe("Staged into slot B");
    expect(within(result).getByRole("button", { name: "Copy" })).toBeInTheDocument();
    expect(
      await screen.findByText("0.2.0", { selector: "[data-version=staged]" }),
    ).toBeInTheDocument();
    expect(line("Other slot: staged 0.2.0")).toBeInTheDocument();
  });

  it("verifies a patch .bin against the running version", async () => {
    const user = userEvent.setup();
    await openPage();
    await uploadAndVerify(user, binFile("signed patch", "sneakers-appliance-0.1.1-amd64.bin"));
    const result = await screen.findByRole("region", { name: "Verify result" });
    expect(within(result).getByText(/patch 0.1.1 for 0.1.0/)).toBeInTheDocument();
  });

  it("shows a refused file's reason and stages nothing", async () => {
    const user = userEvent.setup();
    await openPage();
    await uploadAndVerify(user, binFile("tampered release"));
    const refusal = await screen.findByRole("alert");
    expect(within(refusal).getByText(/UPGRADE_SIGNATURE/)).toBeInTheDocument();
    expect(within(refusal).getByText(/Nothing was staged/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Apply/ })).not.toBeInTheDocument();
    expect(screen.getByText("Other slot: 0.0.9 (revert target)")).toBeInTheDocument();
  });

  it("shows the upload's progress while it sends", async () => {
    applyMockScenario("uploading");
    const user = userEvent.setup();
    await openPage();
    await user.upload(screen.getByLabelText("Update .bin file"), binFile("signed release"));
    await user.click(screen.getByRole("button", { name: "Upload" }));
    const bar = await screen.findByRole("progressbar", { name: "Upload progress" });
    expect(bar).toHaveAttribute("value", "40");
  });

  it("says it's verifying while the box checks the file", async () => {
    applyMockScenario("verifying");
    const user = userEvent.setup();
    await openPage();
    await uploadAndVerify(user, binFile("signed release"));
    expect(
      await screen.findByText(/Verifying the signature, channel and hash/),
    ).toBeInTheDocument();
  });

  describe("the verify result panel", () => {
    it("shows a received file, not checked yet, in an info panel", async () => {
      const user = userEvent.setup();
      await openPage();
      await user.upload(screen.getByLabelText("Update .bin file"), binFile("signed release"));
      await user.click(screen.getByRole("button", { name: "Upload" }));
      const result = await panel();
      expect(result).toHaveAttribute("data-tone", "info");
      expect(within(result).getByText(/hasn't been checked yet/)).toBeInTheDocument();
      expect(within(result).getByRole("button", { name: "Verify and stage" })).toBeInTheDocument();
    });

    it("shows the upload's progress in an info panel", async () => {
      applyMockScenario("uploading");
      const user = userEvent.setup();
      await openPage();
      await user.upload(screen.getByLabelText("Update .bin file"), binFile("signed release"));
      await user.click(screen.getByRole("button", { name: "Upload" }));
      const result = await panel();
      expect(result).toHaveAttribute("data-tone", "info");
      expect(
        within(result).getByRole("progressbar", { name: "Upload progress" }),
      ).toBeInTheDocument();
    });

    it("shows the check running in an info panel", async () => {
      applyMockScenario("verifying");
      const user = userEvent.setup();
      await openPage();
      await uploadAndVerify(user, binFile("signed release"));
      const result = await panel();
      await within(result).findByText(/Verifying the signature, channel and hash/);
      expect(result).toHaveAttribute("data-tone", "info");
    });

    it("shows a verified file in a green panel", async () => {
      const user = userEvent.setup();
      await openPage();
      await uploadAndVerify(user, binFile("signed release"));
      expect(await screen.findByText("Verified")).toBeInTheDocument();
      expect(await panel()).toHaveAttribute("data-tone", "ok");
    });

    it("shows a refused verify in a red panel with the reason and the error code", async () => {
      const user = userEvent.setup();
      await openPage();
      await uploadAndVerify(user, binFile("tampered release"));
      await screen.findByText(/was refused/);
      const result = await panel();
      expect(result).toHaveAttribute("data-tone", "danger");
      expect(
        within(result).getByText(/isn't signed by this box's release key/),
      ).toBeInTheDocument();
      expect(within(result).getByText("UPGRADE_SIGNATURE")).toBeInTheDocument();
    });

    it("shows a refused upload in a red panel", async () => {
      vi.spyOn(upgrade, "upload").mockRejectedValueOnce(
        new Error("UPGRADE_UPLOAD: the file is larger than the box takes"),
      );
      const user = userEvent.setup();
      await openPage();
      await user.upload(screen.getByLabelText("Update .bin file"), binFile("signed release"));
      await user.click(screen.getByRole("button", { name: "Upload" }));
      const result = await panel();
      expect(result).toHaveAttribute("data-tone", "danger");
      expect(within(result).getByText(/larger than the box takes/)).toBeInTheDocument();
      expect(within(result).getByText("UPGRADE_UPLOAD")).toBeInTheDocument();
    });

    it("shows a refused fetch in a red panel, not a toast", async () => {
      const user = userEvent.setup();
      await openPage();
      await user.type(screen.getByLabelText("File name on the mirror"), "not-an-update.bin");
      await user.click(screen.getByRole("button", { name: "Fetch" }));
      const result = await panel();
      expect(result).toHaveAttribute("data-tone", "danger");
      expect(within(result).getByText(/not-an-update.bin was refused/)).toBeInTheDocument();
      expect(within(result).getByText("UPGRADE_UPLOAD")).toBeInTheDocument();
    });

    it("holds the check in an amber panel while it waits for a fresh code", async () => {
      applyMockScenario("stepup");
      const user = userEvent.setup();
      await openPage();
      await uploadAndVerify(user, binFile("signed release"));
      await vi.waitFor(() => expect(stepUpPending()).toBe(true));
      const result = await panel();
      expect(result).toHaveAttribute("data-tone", "warn");
      expect(within(result).getByText("Waiting for your authenticator code")).toBeInTheDocument();
      cancelStepUp();
    });

    it("shows a cancelled step-up in a red panel, and the file can still be verified", async () => {
      applyMockScenario("stepup");
      const user = userEvent.setup();
      await openPage();
      await uploadAndVerify(user, binFile("signed release"));
      await vi.waitFor(() => expect(stepUpPending()).toBe(true));
      act(() => cancelStepUp());
      const result = await panel();
      await vi.waitFor(() => expect(result).toHaveAttribute("data-tone", "danger"));
      expect(within(result).getByText("ACCESS_STEPUP_REQUIRED")).toBeInTheDocument();
      await user.click(within(result).getByRole("button", { name: "Verify and stage" }));
      expect(await screen.findByText("Verified")).toBeInTheDocument();
    });

    it("verifies once the step-up code is taken", async () => {
      applyMockScenario("stepup");
      const user = userEvent.setup();
      await openPage();
      await uploadAndVerify(user, binFile("signed release"));
      await vi.waitFor(() => expect(stepUpPending()).toBe(true));
      act(() => resumeStepUp());
      expect(await screen.findByText("Verified")).toBeInTheDocument();
      expect(await panel()).toHaveAttribute("data-tone", "ok");
    });
  });

  it("fetches from the configured mirror", async () => {
    const user = userEvent.setup();
    await openPage();
    expect(screen.getByText(/mirror.example.org/)).toBeInTheDocument();
    await user.type(
      screen.getByLabelText("File name on the mirror"),
      "sneakers-appliance-0.2.0-amd64.bin",
    );
    await user.click(screen.getByRole("button", { name: "Fetch" }));
    expect(
      await screen.findByText(/Fetched sneakers-appliance-0.2.0-amd64.bin/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Verify and stage" })).toBeInTheDocument();
  });

  it("hides the mirror fetch on an air-gapped box", async () => {
    applyMockScenario("air-gapped");
    await openPage();
    expect(screen.getByText("Air-gapped: upload only")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Fetch" })).not.toBeInTheDocument();
  });

  it("applies the staged release only with its version typed and a fresh code", async () => {
    applyMockScenario("staged");
    const user = userEvent.setup();
    await openPage();
    await user.click(screen.getByRole("button", { name: "Apply 0.2.0" }));
    const dialog = await screen.findByRole("dialog");
    const confirm = within(dialog).getByRole("button", { name: "Apply and reboot" });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByLabelText("Type 0.2.0 to confirm"), "0.2.0");
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByLabelText("Authenticator code"), "123456");
    expect(confirm).not.toBeDisabled();
    await user.click(confirm);
    const restarting = await screen.findByRole("region", { name: "Restarting" });
    expect(within(restarting).getByText(/Applying 0.2.0/)).toBeInTheDocument();
    expect(
      within(restarting).getByRole("heading", { name: "The box is restarting" }),
    ).toBeInTheDocument();
  });

  it("keeps a wrong code's refusal in the dialog, with the tries left", async () => {
    applyMockScenario("staged");
    const user = userEvent.setup();
    await openPage();
    await user.click(screen.getByRole("button", { name: "Apply 0.2.0" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Type 0.2.0 to confirm"), "0.2.0");
    await user.type(within(dialog).getByLabelText("Authenticator code"), "000000");
    await user.click(within(dialog).getByRole("button", { name: "Apply and reboot" }));
    expect(await within(dialog).findByText(/That code didn't work/)).toBeInTheDocument();
    expect(within(dialog).getByText(/tries? left/)).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Restarting" })).not.toBeInTheDocument();
  });

  it("asks for the code even right after a stage, whatever the step-up window says", async () => {
    applyMockScenario("staged");
    await expect(upgrade.apply("")).rejects.toThrow(/ACCESS_CONFIRM/);
  });

  it("names who holds an open elevated shell", async () => {
    applyMockScenario("elevated");
    await openPage();
    const notice = screen.getByRole("region", { name: "Elevated shell open" });
    expect(within(notice).getByText(/bob holds an elevated shell \(E-9M4T\)/)).toBeInTheDocument();
  });

  it("shows the refusal with who holds the shell, then ends it and applies with the typed override", async () => {
    applyMockScenario("staged");
    applyMockScenario("elevated");
    const user = userEvent.setup();
    await openPage();
    await user.click(screen.getByRole("button", { name: "Apply 0.2.0" }));
    await user.type(screen.getByLabelText("Type 0.2.0 to confirm"), "0.2.0");
    await user.type(screen.getByLabelText("Authenticator code"), "123456");
    await user.click(screen.getByRole("button", { name: "Apply and reboot" }));
    const refusal = await screen.findByRole("region", { name: "Apply refused" });
    expect(within(refusal).getByText(/UPGRADE_ELEVATED/)).toBeInTheDocument();
    expect(within(refusal).getByText(/bob holds an elevated shell \(E-9M4T\)/)).toBeInTheDocument();
    expect(screen.queryByText(/Applying 0.2.0/)).not.toBeInTheDocument();

    await user.click(within(refusal).getByRole("button", { name: "End bob's shell and apply" }));
    const dialog = await screen.findByRole("dialog");
    const go = within(dialog).getByRole("button", { name: "End the shell and apply" });
    await user.type(within(dialog).getByLabelText("Reason"), "the security fix can't wait");
    await user.type(within(dialog).getByLabelText("Type bob E-9M4T to confirm"), "bob E-9M4");
    expect(go).toBeDisabled();
    await user.type(within(dialog).getByLabelText("Type bob E-9M4T to confirm"), "T");
    expect(go).toBeDisabled();
    await user.type(within(dialog).getByLabelText("Authenticator code"), "234567");
    expect(go).not.toBeDisabled();
    await user.click(go);
    expect(await screen.findByText(/Applying 0.2.0/)).toBeInTheDocument();
    const history = await elevation.list();
    expect(history.elevations.find((item) => item.id === "E-9M4T")?.state).toBe("ended");
  });

  it("ends the shell before the release applies", async () => {
    applyMockScenario("staged");
    applyMockScenario("elevated");
    const order: string[] = [];
    const real = upgrade.apply;
    vi.spyOn(upgrade, "apply").mockImplementation(async (code, override) => {
      const result = await real(code, override);
      const after = await upgrade.get();
      order.push(
        after.activeElevations?.length ? "applied under a shell" : "shell ended, then applied",
      );
      return result;
    });
    await expect(upgrade.apply("123456")).rejects.toThrow(/UPGRADE_ELEVATED/);
    await upgrade.apply("234567", {
      confirm: "bob E-9M4T",
      elevationId: "E-9M4T",
      reason: "patch now",
    });
    expect(order).toEqual(["shell ended, then applied"]);
    const after = await upgrade.get();
    expect(after.history?.[0]?.detail).toBe("ended elevated shell E-9M4T");
  });

  it("refuses a wrong confirmation and leaves the shell open", async () => {
    applyMockScenario("staged");
    applyMockScenario("elevated");
    await expect(
      upgrade.apply("123456", {
        confirm: "alice E-9M4T",
        elevationId: "E-9M4T",
        reason: "patch now",
      }),
    ).rejects.toThrow(/ACCESS_CONFIRM/);
    const { elevations } = await elevation.list();
    expect(elevations.find((item) => item.id === "E-9M4T")?.state).toBe("active");
  });

  it("shows the box's refusal of an override in the dialog", async () => {
    applyMockScenario("elevated");
    const user = userEvent.setup();
    await openPage();
    await user.click(screen.getByRole("button", { name: "Revert to 0.0.9" }));
    await user.type(screen.getByLabelText("Type 0.1.0 to confirm"), "0.1.0");
    await user.type(screen.getByLabelText("Authenticator code"), "123456");
    await user.click(screen.getByRole("button", { name: "Revert and reboot" }));
    const refusal = await screen.findByRole("region", { name: "Revert refused" });
    await user.click(within(refusal).getByRole("button", { name: "End bob's shell and revert" }));
    const dialog = await screen.findByRole("dialog");
    vi.spyOn(upgrade, "revert").mockRejectedValueOnce(
      new OsadminError(
        "invalid_argument",
        'ACCESS_CONFIRM: type "bob E-9M4T" to confirm ending bob\'s elevated shell',
      ),
    );
    await user.type(within(dialog).getByLabelText("Reason"), "roll back the bad release");
    await user.type(within(dialog).getByLabelText("Type bob E-9M4T to confirm"), "bob E-9M4T");
    await user.type(within(dialog).getByLabelText("Authenticator code"), "234567");
    await user.click(within(dialog).getByRole("button", { name: "End the shell and revert" }));
    expect(await within(dialog).findByText(/ACCESS_CONFIRM/)).toBeInTheDocument();
    expect(screen.queryByText(/Reverting to the other slot/)).not.toBeInTheDocument();
  });

  it("refuses a non-owner's override, and doesn't offer one", async () => {
    applyMockScenario("elevated");
    signInAs("bob");
    await openPage();
    expect(screen.getByRole("region", { name: "Elevated shell open" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /End bob's shell/ })).not.toBeInTheDocument();
    await expect(
      upgrade.revert("123456", { confirm: "bob E-9M4T", elevationId: "E-9M4T", reason: "mine" }),
    ).rejects.toThrow(/ACCESS_FORBIDDEN/);
  });

  it("reverts to the other slot with the running version typed and a fresh code", async () => {
    const user = userEvent.setup();
    await openPage();
    await user.click(screen.getByRole("button", { name: "Revert to 0.0.9" }));
    const dialog = await screen.findByRole("dialog");
    const confirm = within(dialog).getByRole("button", { name: "Revert and reboot" });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByLabelText("Type 0.1.0 to confirm"), "0.1.0");
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByLabelText("Authenticator code"), "123456");
    await user.click(confirm);
    const restarting = await screen.findByRole("region", { name: "Restarting" });
    expect(within(restarting).getByText(/Reverting to the other slot/)).toBeInTheDocument();
  });

  it("names the release kept in the other slot as the revert target", async () => {
    await openPage();
    expect(screen.getByText("Other slot: 0.0.9 (revert target)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Revert to 0.0.9" })).toBeInTheDocument();
  });

  it("shows a staged release in the other slot, with nothing to revert to", async () => {
    applyMockScenario("staged");
    await openPage();
    expect(line("Other slot: staged 0.2.0")).toBeInTheDocument();
    expect(screen.queryByText(/revert target/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Revert to/ })).not.toBeInTheDocument();
  });

  it("says the other slot is empty only when there's really nothing in it", async () => {
    applyMockScenario("no-previous");
    await openPage();
    expect(screen.getByText("Other slot: empty")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Revert to/ })).not.toBeInTheDocument();
  });

  it("says before the stage which release staging a base update removes", async () => {
    const user = userEvent.setup();
    await openPage();
    expect(line("Staging a base update removes 0.0.9 and its files.")).toBeInTheDocument();
    await user.upload(screen.getByLabelText("Update .bin file"), binFile("signed release"));
    await user.click(screen.getByRole("button", { name: "Upload" }));
    const step = await panel();
    expect(within(step).getByText("This removes 0.0.9 and its files.")).toBeInTheDocument();
    expect(within(step).getByRole("button", { name: "Verify and stage" })).toBeInTheDocument();
  });

  it("names a staged release as the one the next stage removes", async () => {
    applyMockScenario("staged");
    await openPage();
    expect(line("Staging a base update removes 0.2.0 and its files.")).toBeInTheDocument();
  });

  it("says nothing about a removal when the other slot is empty", async () => {
    applyMockScenario("no-previous");
    await openPage();
    expect(screen.queryByText(/and its files/)).not.toBeInTheDocument();
  });

  it("doesn't name a base release for a product bundle's stage", async () => {
    const user = userEvent.setup();
    await openPage();
    await user.upload(
      screen.getByLabelText("Update .bin file"),
      binFile("signed bundle", "sneakers-product-0.2.0-amd64.bin"),
    );
    await user.click(screen.getByRole("button", { name: "Upload" }));
    expect(within(await panel()).queryByText(/and its files/)).not.toBeInTheDocument();
  });

  it("shows a revert an admin asked for as reverted, not failed", async () => {
    applyMockScenario("reverted");
    await openPage();
    expect(screen.getByText("Reverted from 0.2.0")).toBeInTheDocument();
    expect(screen.getByText(/By alice/)).toBeInTheDocument();
    expect(screen.queryByText(/failed to boot/)).not.toBeInTheDocument();
  });

  it("still shows a boot-counting fallback as failed", async () => {
    applyMockScenario("failed");
    await openPage();
    expect(screen.getByText("0.2.0 failed to boot")).toBeInTheDocument();
    expect(screen.queryByText(/Reverted from/)).not.toBeInTheDocument();
  });

  it("switches the update window to manual only", async () => {
    const user = userEvent.setup();
    await openPage();
    await user.click(screen.getByRole("radio", { name: "Manual only" }));
    await user.click(screen.getByRole("button", { name: "Save update window" }));
    expect(await screen.findByText("Update window saved.")).toBeInTheDocument();
    expect(
      await screen.findByText(/Manual only: an owner applies each update/),
    ).toBeInTheDocument();
  });

  it("changes the daily window's start time", async () => {
    const user = userEvent.setup();
    await openPage();
    const start = screen.getByLabelText("Daily start (HH:MM)");
    await user.clear(start);
    await user.type(start, "03:30");
    await user.click(screen.getByRole("button", { name: "Save update window" }));
    expect(await screen.findByText(/Daily at 03:30 for 120 minutes/)).toBeInTheDocument();
  });

  it("says it isn't available when the box's update backend isn't there", async () => {
    vi.spyOn(upgrade, "get").mockRejectedValueOnce(
      new OsadminError("unimplemented", "UpgradeService isn't on this box"),
    );
    renderPage(Updates);
    expect(await screen.findByText("Updates: not available in this release")).toBeInTheDocument();
  });

  it("shows an empty history without crashing when the box leaves it out of the reply", async () => {
    // A box that's never had an update event omits `history` entirely (an empty repeated
    // field isn't sent), unlike the mock, which always fills it in.
    const { history, ...rest } = await upgrade.get();
    expect(history?.length).toBeGreaterThan(0);
    vi.spyOn(upgrade, "get").mockResolvedValueOnce(rest as Awaited<ReturnType<typeof upgrade.get>>);
    await openPage();
    const table = screen.getByRole("table", { name: "Update history" });
    expect(within(table).queryAllByRole("row")).toHaveLength(1);
  });

  it("shows a non-owner the state but no install actions", async () => {
    signInAs("bob");
    await openPage();
    expect(
      screen.getByText("Only an owner can install, apply or revert updates."),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Update .bin file")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Revert to 0.0.9" })).not.toBeInTheDocument();
  });

  describe("the product bundle", () => {
    it("shows the installed, staged and previous product versions", async () => {
      applyMockScenario("product-staged");
      await openPage();
      const product = within(screen.getByRole("region", { name: "Product" }));
      expect(product.getByText("Installed 0.1.0")).toBeInTheDocument();
      expect(product.getByText("Staged 0.2.0")).toBeInTheDocument();
      expect(product.getByText("Previous 0.0.9")).toBeInTheDocument();
      expect(product.getByText("running")).toBeInTheDocument();
    });

    it("lists only the product versions that fit this base, newest first", async () => {
      await openPage();
      const versions = within(await screen.findByRole("radiogroup", { name: "Product versions" }));
      const options = versions.getAllByRole("radio");
      expect(options.map((o) => o.getAttribute("value"))).toEqual(["0.2.0", "0.1.1"]);
      expect(screen.getByText(/fit base 0.1.0/)).toBeInTheDocument();
    });

    it("installs the first product: pick a version, fetch, verify and stage, then install", async () => {
      applyMockScenario("no-product");
      const user = userEvent.setup();
      await openPage();
      const product = within(screen.getByRole("region", { name: "Product" }));
      expect(product.getByText(/Not installed yet/)).toBeInTheDocument();
      await user.click(await screen.findByRole("radio", { name: /0\.2\.0/ }));
      await user.click(screen.getByRole("button", { name: "Fetch 0.2.0" }));
      expect(
        await screen.findByText(/Fetched sneakers-product-0.2.0-amd64.bin/),
      ).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Verify and stage" }));
      const result = await screen.findByRole("region", { name: "Verify result" });
      expect(within(result).getByText(/product bundle 0.2.0/)).toBeInTheDocument();
      expect(await product.findByText("Staged 0.2.0")).toBeInTheDocument();
      await user.click(product.getByRole("button", { name: "Install product 0.2.0" }));
      const dialog = within(await screen.findByRole("dialog"));
      expect(dialog.getByText(/no reboot/)).toBeInTheDocument();
      await user.type(dialog.getByLabelText("Type 0.2.0 to confirm"), "0.2.0");
      await user.type(dialog.getByLabelText("Authenticator code"), "123456");
      await user.click(dialog.getByRole("button", { name: "Install and restart the product" }));
      expect(await screen.findByText("Installing product 0.2.0")).toBeInTheDocument();
      const after = await upgrade.get();
      expect(after.product).toMatchObject({ installedVersion: "0.2.0", stagedVersion: "" });
    });

    it("reverts the product to the previous slot", async () => {
      applyMockScenario("product-staged");
      const user = userEvent.setup();
      await openPage();
      const product = within(screen.getByRole("region", { name: "Product" }));
      await user.click(product.getByRole("button", { name: "Revert product to 0.0.9" }));
      const dialog = within(await screen.findByRole("dialog"));
      await user.type(dialog.getByLabelText("Type 0.0.9 to confirm"), "0.0.9");
      await user.type(dialog.getByLabelText("Authenticator code"), "123456");
      await user.click(dialog.getByRole("button", { name: "Revert the product" }));
      expect(await screen.findByText("Reverting the product to 0.0.9")).toBeInTheDocument();
      const after = await upgrade.get();
      expect(after.product?.installedVersion).toBe("0.0.9");
    });

    it("says to upload the product bundle on an air-gapped box", async () => {
      applyMockScenario("air-gapped");
      await openPage();
      expect(
        await screen.findByText(/upload the product bundle's \.bin above/),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("radiogroup", { name: "Product versions" }),
      ).not.toBeInTheDocument();
    });

    it("lets an owner allow fetches from the release source", async () => {
      const user = userEvent.setup();
      await openPage();
      await user.click(screen.getByRole("checkbox", { name: /release source/ }));
      await user.click(screen.getByRole("button", { name: "Save update window" }));
      await vi.waitFor(async () => {
        const after = await upgrade.get();
        expect(after.policy?.direct).toBe(true);
      });
    });

    it("hides the product when the box's backend doesn't report one", async () => {
      const { product, ...rest } = await upgrade.get();
      expect(product).toBeDefined();
      vi.spyOn(upgrade, "get").mockResolvedValue(rest as Awaited<ReturnType<typeof upgrade.get>>);
      await openPage();
      expect(screen.queryByRole("region", { name: "Product" })).not.toBeInTheDocument();
    });
  });
});
