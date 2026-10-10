import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { elevation, upgrade } from "@/lib/osadmin/client";
import { OsadminError } from "@/lib/osadmin/errors";
import { stepUpPending } from "@/lib/osadmin/stepUpController";
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

/** The step marked current in scope's step list. */
const currentStep = (scope: HTMLElement) =>
  within(scope)
    .getAllByRole("listitem")
    .find((item) => item.getAttribute("aria-current") === "step")?.textContent;

describe("Updates", () => {
  beforeEach(() => signInAs("alice"));

  it("shows the running version, the other slot, the update window and the history", async () => {
    await openPage();
    const base = within(screen.getByRole("region", { name: "Base OS" }));
    expect(base.getByText("0.1.0", { selector: "[data-version=running]" })).toBeInTheDocument();
    expect(base.getByText("In the active slot.")).toBeInTheDocument();
    expect(base.getByText("Other slot: 0.0.9 (revert target)")).toBeInTheDocument();
    expect(screen.getByText(/Daily at 02:00 for 120 minutes/)).toBeInTheDocument();
    const history = screen.getByRole("table", { name: "Update history" });
    expect(within(history).getAllByRole("row").length).toBeGreaterThan(1);
  });

  it("shows a staged base release next to the running one", async () => {
    applyMockScenario("staged");
    await openPage();
    const base = within(screen.getByRole("region", { name: "Base OS" }));
    expect(base.getByText("0.2.0", { selector: "[data-version=staged]" })).toBeInTheDocument();
    expect(base.queryByText(/revert target/)).not.toBeInTheDocument();
  });

  it("uploads a .bin, then shows the verified signature, channel and hash before it stages", async () => {
    const user = userEvent.setup();
    await openPage();
    await user.upload(screen.getByLabelText("Update .bin file"), binFile("signed release"));
    await user.click(screen.getByRole("button", { name: "Upload" }));
    expect(await screen.findByText(/Uploaded\. It hasn't been checked yet/)).toBeInTheDocument();
    expect(screen.getByText("Full")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy the file name" })).toBeInTheDocument();
    expect(screen.queryByText(/Signature: verified/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Verify and stage" }));
    const result = await screen.findByRole("region", { name: "Verify result" });
    expect(within(result).getByText("Verified")).toBeInTheDocument();
    expect(within(result).getByText("Full")).toBeInTheDocument();
    const terms = within(result)
      .getAllByRole("term")
      .map((term) => term.textContent);
    expect(terms).toEqual(["Version", "Architecture", "Signature", "Channel", "SHA-256", "Staged"]);
    const values = within(result)
      .getAllByRole("definition")
      .map((value) => value.textContent);
    expect(values[0]).toBe("full release 0.2.0");
    expect(values[1]).toBe("amd64");
    expect(values[2]).toBe("Verified against this appliance's release key");
    expect(values[3]).toBe("stable");
    expect(values[4]).toMatch(/^[0-9a-f]{64}Copy$/);
    expect(values[5]).toBe("Staged into slot B");
    expect(within(result).getByRole("button", { name: "Copy" })).toBeInTheDocument();
    expect(within(result).getByRole("button", { name: "Copy the file name" })).toBeInTheDocument();
    expect(
      await screen.findByText("0.2.0", { selector: "[data-version=staged]" }),
    ).toBeInTheDocument();
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

  describe("the update's steps", () => {
    it("lists the steps while the file stages, with the bytes written into the slot", async () => {
      applyMockScenario("verifying");
      const user = userEvent.setup();
      await openPage();
      await uploadAndVerify(user, binFile("signed release"));
      const box = await panel();
      const result = within(box);
      await result.findByRole("list", { name: "Update steps" });
      expect(currentStep(box)).toMatch(/Staging into slot B/);
      expect(result.getByRole("progressbar", { name: "Staging into slot B" })).toHaveAttribute(
        "value",
        "50",
      );
      expect(result.getByText("Writing the release into slot B.")).toBeInTheDocument();
    });

    it("says which step a refused file failed at when the page is opened again, inside the Base OS row", async () => {
      const { uploadId } = await upgrade.upload(binFile("tampered release"));
      await expect(upgrade.stage(uploadId)).rejects.toThrow();
      await openPage();
      const base = within(screen.getByRole("region", { name: "Base OS" }));
      const last = within(await base.findByRole("region", { name: "Update progress" }));
      expect(last.getByText("The last update didn't finish")).toBeInTheDocument();
      const failed = last.getAllByRole("listitem").find((item) => item.dataset.state === "failed");
      expect(failed).toHaveTextContent("Verifying (signature, channel, SHA-256)");
      expect(
        within(screen.getByRole("region", { name: "Product" })).queryByRole("region", {
          name: "Update progress",
        }),
      ).not.toBeInTheDocument();
    });

    it("shows the restart page with the box rebooting into the release", async () => {
      applyMockScenario("staged");
      const user = userEvent.setup();
      await openPage();
      await user.click(screen.getByRole("button", { name: "Apply update" }));
      const dialog = await screen.findByRole("dialog");
      await user.type(within(dialog).getByLabelText("Type 0.2.0 to confirm"), "0.2.0");
      await user.type(within(dialog).getByLabelText("Authenticator code"), "123456");
      await user.click(within(dialog).getByRole("button", { name: "Apply and reboot" }));
      const restarting = await screen.findByRole("region", { name: "Restarting" });
      await within(restarting).findByRole("list", { name: "Update steps" });
      expect(currentStep(restarting)).toMatch(/Rebooting/);
    });
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

    it("shows a refused fetch in a red panel on its card, not a toast", async () => {
      vi.spyOn(upgrade, "fetch").mockRejectedValueOnce(
        new OsadminError(
          "failed_precondition",
          "UPGRADE_UPLOAD: the mirror answered 404 Not Found for the .bin",
          "UPGRADE_UPLOAD",
        ),
      );
      const user = userEvent.setup();
      await openPage();
      const base = within(screen.getByRole("region", { name: "Base OS" }));
      await user.click(await base.findByRole("button", { name: "Fetch 0.2.0" }));
      const result = within(screen.getByRole("region", { name: "Base OS" })).getByRole("region", {
        name: "Verify result",
      });
      expect(result).toHaveAttribute("data-tone", "danger");
      expect(within(result).getByText("The file was refused")).toBeInTheDocument();
      expect(within(result).getByText("Patch")).toBeInTheDocument();
      expect(within(result).getByText("UPGRADE_UPLOAD")).toBeInTheDocument();
    });

    it("verifies with no authenticator code: only Apply and Revert ask for one", async () => {
      applyMockScenario("stepup");
      const user = userEvent.setup();
      await openPage();
      await uploadAndVerify(user, binFile("signed release"));
      expect(await screen.findByText("Verified")).toBeInTheDocument();
      expect(stepUpPending()).toBe(false);
      expect(await panel()).toHaveAttribute("data-tone", "ok");
    });
  });

  it("fetches the Base OS the mirror offers, the patch picked to begin with", async () => {
    const user = userEvent.setup();
    await openPage();
    expect(screen.getAllByText(/mirror.example.org/).length).toBeGreaterThan(0);
    const base = within(screen.getByRole("region", { name: "Base OS" }));
    const offers = within(await base.findByRole("radiogroup", { name: "Base OS versions" }));
    const [patch, full] = offers.getAllByRole("radio");
    expect(patch).toBeChecked();
    expect(full).not.toBeChecked();
    expect(offers.getByText("Patch 0.1.0 → 0.2.0")).toBeInTheDocument();
    expect(offers.getByText("full")).toBeInTheDocument();
    expect(offers.getByText("(1.4 MB)")).toBeInTheDocument();
    expect(offers.getByText("(72 MB)")).toBeInTheDocument();
    await user.click(base.getByRole("button", { name: "Fetch 0.2.0" }));
    expect(await base.findByText(/Fetched\. It hasn't been checked yet/)).toBeInTheDocument();
    expect(base.getByText("Patch")).toBeInTheDocument();
    expect(base.getByRole("button", { name: "Verify and stage" })).toBeInTheDocument();
    await user.click(full as HTMLElement);
    expect(base.getByRole("button", { name: "Fetch 0.2.0" })).toBeDisabled();
  });

  it("hides the mirror fetch on an air-gapped box", async () => {
    applyMockScenario("air-gapped");
    await openPage();
    expect(screen.getByText("Air-gapped: upload only")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Fetch/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Check now" })).not.toBeInTheDocument();
  });

  it("applies the staged release only with its version typed and a fresh code", async () => {
    applyMockScenario("staged");
    const user = userEvent.setup();
    await openPage();
    await user.click(screen.getByRole("button", { name: "Apply update" }));
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
    await user.click(screen.getByRole("button", { name: "Apply update" }));
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
    await user.click(screen.getByRole("button", { name: "Apply update" }));
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
    expect(screen.getByText("0.2.0", { selector: "[data-version=staged]" })).toBeInTheDocument();
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

  it("says staging another base update replaces a staged release, not that it removes it", async () => {
    applyMockScenario("staged");
    const user = userEvent.setup();
    await openPage();
    expect(
      line("0.2.0 is staged. Staging another base update replaces it and its files."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/removes 0\.2\.0/)).not.toBeInTheDocument();
    await user.upload(screen.getByLabelText("Update .bin file"), binFile("signed release"));
    await user.click(screen.getByRole("button", { name: "Upload" }));
    const step = await panel();
    expect(
      within(step).getByText("This replaces the staged 0.2.0 and its files."),
    ).toBeInTheDocument();
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

  it("doesn't offer a pages revert the built-in pages would outrank, and says why", async () => {
    const got = await upgrade.get();
    vi.spyOn(upgrade, "get").mockResolvedValue({
      ...got,
      baseWeb: {
        ...got.baseWeb!,
        builtinVersion: "0.3.0",
        canRevert: false,
        currentVersion: "0.2.1",
        previousVersion: "0.2.0",
        runningVersion: "0.3.0",
        source: "built-in",
      },
    });
    await openPage();
    const card = screen.getByTestId("card-web");
    expect(within(card).queryByRole("button", { name: /^Revert pages/ })).not.toBeInTheDocument();
    expect(
      within(card).getByText(/Previous: 0\.2\.0, older than the built-in pages/),
    ).toBeInTheDocument();
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
      expect(
        product.getByText("0.1.0", { selector: "[data-version=installed]" }),
      ).toBeInTheDocument();
      expect(product.getByText("0.2.0", { selector: "[data-version=staged]" })).toBeInTheDocument();
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
      const offers = within(await product.findByRole("radiogroup", { name: "Product versions" }));
      await user.click(offers.getByRole("radio", { name: /0\.2\.0/ }));
      await user.click(product.getByRole("button", { name: "Fetch 0.2.0" }));
      expect(await screen.findByText(/Fetched\. It hasn't been checked yet/)).toBeInTheDocument();
      expect(screen.getByText("Full")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Verify and stage" }));
      const result = await screen.findByRole("region", { name: "Verify result" });
      expect(within(result).getByText(/product bundle 0.2.0/)).toBeInTheDocument();
      expect(
        await product.findByText("0.2.0", { selector: "[data-version=staged]" }),
      ).toBeInTheDocument();
      await user.click(product.getByRole("button", { name: "Apply update" }));
      const dialog = within(await screen.findByRole("dialog"));
      expect(dialog.getByText(/no reboot/)).toBeInTheDocument();
      await user.type(dialog.getByLabelText("Type 0.2.0 to confirm"), "0.2.0");
      await user.type(dialog.getByLabelText("Authenticator code"), "123456");
      await user.click(dialog.getByRole("button", { name: "Install and restart the product" }));
      expect(await screen.findByText("Installing product 0.2.0")).toBeInTheDocument();
      const after = await upgrade.get();
      expect(after.product).toMatchObject({ installedVersion: "0.2.0", stagedVersion: "" });
    });

    it("shows the install's own step progress, then clears the installing banner once it runs", async () => {
      applyMockScenario("product-staged");
      const user = userEvent.setup();
      await openPage();
      const product = within(screen.getByRole("region", { name: "Product" }));
      await user.click(product.getByRole("button", { name: "Apply update" }));
      const dialog = within(await screen.findByRole("dialog"));
      await user.type(dialog.getByLabelText("Type 0.2.0 to confirm"), "0.2.0");
      await user.type(dialog.getByLabelText("Authenticator code"), "123456");
      await user.click(dialog.getByRole("button", { name: "Install and restart the product" }));
      expect(await screen.findByText("Installing product 0.2.0")).toBeInTheDocument();
      expect(await product.findByText("stopped")).toBeInTheDocument();
      // Something says which step it's on, the whole way through (issue sneakers-appliance
      // #218), inside the Product row itself, not a banner above all three units.
      expect(await product.findByRole("region", { name: "Update progress" })).toBeInTheDocument();
      expect(await product.findByText("running", {}, { timeout: 10_000 })).toBeInTheDocument();
      expect(
        product.getByText("0.2.0", { selector: "[data-version=installed]" }),
      ).toBeInTheDocument();
      await vi.waitFor(() =>
        expect(screen.queryByText("Installing product 0.2.0")).not.toBeInTheDocument(),
      );
    }, 15_000);

    it("opens the install's progress while the install call is still answering", async () => {
      applyMockScenario("product-staged");
      const apply = upgrade.apply;
      let answered = false;
      // The box answers the install only after the product's restart; its steps run meanwhile.
      const slow = vi.spyOn(upgrade, "apply").mockImplementation(async (...callArguments) => {
        const done = await apply(...callArguments);
        await new Promise((resolve) => setTimeout(resolve, 6000));
        answered = true;
        return done;
      });
      const user = userEvent.setup();
      await openPage();
      const product = within(screen.getByRole("region", { name: "Product" }));
      await user.click(product.getByRole("button", { name: "Apply update" }));
      const dialog = within(await screen.findByRole("dialog"));
      await user.type(dialog.getByLabelText("Type 0.2.0 to confirm"), "0.2.0");
      await user.type(dialog.getByLabelText("Authenticator code"), "123456");
      await user.click(dialog.getByRole("button", { name: "Install and restart the product" }));
      expect(
        await product.findByRole("region", { name: "Update progress" }, { timeout: 4000 }),
      ).toBeInTheDocument();
      expect(answered).toBe(false);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.getByText("Installing product 0.2.0")).toBeInTheDocument();
      slow.mockRestore();
    }, 15_000);

    it("keeps the install's progress open in the tab that verified and installed it", async () => {
      applyMockScenario("no-product");
      const get = upgrade.get;
      // On the box k0s runs again right after the restart, long before the rollout is done.
      const running = vi.spyOn(upgrade, "get").mockImplementation(async () => {
        const response = await get();
        return response.product
          ? { ...response, product: { ...response.product, running: true } }
          : response;
      });
      const user = userEvent.setup();
      await openPage();
      const product = within(screen.getByRole("region", { name: "Product" }));
      const offers = within(await product.findByRole("radiogroup", { name: "Product versions" }));
      await user.click(offers.getByRole("radio", { name: /0\.2\.0/ }));
      await user.click(product.getByRole("button", { name: "Fetch 0.2.0" }));
      await user.click(await screen.findByRole("button", { name: "Verify and stage" }));
      await screen.findByRole("region", { name: "Verify result" });
      await user.click(await product.findByRole("button", { name: "Apply update" }));
      const dialog = within(await screen.findByRole("dialog"));
      await user.type(dialog.getByLabelText("Type 0.2.0 to confirm"), "0.2.0");
      await user.type(dialog.getByLabelText("Authenticator code"), "123456");
      await user.click(dialog.getByRole("button", { name: "Install and restart the product" }));
      expect(await product.findByRole("region", { name: "Update progress" })).toBeInTheDocument();
      await new Promise((resolve) => setTimeout(resolve, 2500));
      expect(product.getByRole("region", { name: "Update progress" })).toBeInTheDocument();
      expect(screen.getByText("Installing product 0.2.0")).toBeInTheDocument();
      await vi.waitFor(
        () => expect(screen.queryByText("Installing product 0.2.0")).not.toBeInTheDocument(),
        { timeout: 12_000 },
      );
      running.mockRestore();
    }, 25_000);

    it("opens the progress by itself when an install starts elsewhere", async () => {
      applyMockScenario("product-staged");
      await openPage();
      const product = within(screen.getByRole("region", { name: "Product" }));
      expect(product.queryByRole("region", { name: "Update progress" })).not.toBeInTheDocument();
      // Another admin's tab, or the update window, starts it.
      await upgrade.apply("123456", undefined, "UPDATE_TARGET_PRODUCT");
      expect(
        await product.findByRole("region", { name: "Update progress" }, { timeout: 8000 }),
      ).toBeInTheDocument();
    }, 15_000);

    it("clears the installing banner when the product doesn't open on 443 in time", async () => {
      applyMockScenario("product-staged");
      applyMockScenario("product-restart-fails");
      const user = userEvent.setup();
      await openPage();
      const product = within(screen.getByRole("region", { name: "Product" }));
      await user.click(product.getByRole("button", { name: "Apply update" }));
      const dialog = within(await screen.findByRole("dialog"));
      await user.type(dialog.getByLabelText("Type 0.2.0 to confirm"), "0.2.0");
      await user.type(dialog.getByLabelText("Authenticator code"), "123456");
      await user.click(dialog.getByRole("button", { name: "Install and restart the product" }));
      expect(await screen.findByText("Installing product 0.2.0")).toBeInTheDocument();
      expect(
        await screen.findByText("The last update didn't finish", {}, { timeout: 12_000 }),
      ).toBeInTheDocument();
      expect(screen.getByText(/didn't open on 443 in time/)).toBeInTheDocument();
      await vi.waitFor(() =>
        expect(screen.queryByText("Installing product 0.2.0")).not.toBeInTheDocument(),
      );
    }, 15_000);

    it("steps the product install through k0s, images, manifests, pods and edge", async () => {
      applyMockScenario("product-staged");
      signInAs("alice");
      await upgrade.apply("123456", undefined, "UPDATE_TARGET_PRODUCT");
      const ids = async () => {
        const response = await upgrade.get();
        return response.upgradeProgress?.steps ?? [];
      };
      const until = async (id: string) => {
        for (let tick = 0; tick < 10; tick++) {
          const steps = await ids();
          const active = steps.find((step) => step.state === "UPGRADE_STEP_STATE_ACTIVE");
          if (active?.id === id) return active;
        }
        throw new Error(`never reached ${id}`);
      };
      const images = await until("images");
      expect(images.detail).toBe("3 of 7 images imported");
      const pods = await until("pods");
      expect(pods.detail).toBe("4 of 5 pods ready");
      const edge = await until("edge");
      expect(edge.label).toBe("Opening the product on 443");
      const final = await upgrade.get();
      expect(final.upgradeProgress?.inProgress).toBe(false);
      expect(
        final.upgradeProgress?.steps.every((step) => step.state === "UPGRADE_STEP_STATE_DONE"),
      ).toBe(true);
      expect(final.product?.running).toBe(true);
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
        await screen.findByText(/upload the product bundle's \.bin under Install an update/),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("radiogroup", { name: "Product versions" }),
      ).not.toBeInTheDocument();
    });

    it("lets an owner take updates from the built-in list", async () => {
      const user = userEvent.setup();
      await openPage();
      const mirror = within(screen.getByRole("region", { name: "Update mirror" }));
      await user.click(mirror.getByRole("radio", { name: "Built-in list" }));
      expect(mirror.queryByLabelText("Mirror")).not.toBeInTheDocument();
      await user.click(mirror.getByRole("button", { name: "Save source" }));
      await vi.waitFor(async () => {
        const after = await upgrade.get();
        expect(after.policy?.source).toBe("builtin");
      });
      expect(await mirror.findByText(/Source: the built-in list/)).toBeInTheDocument();
    });

    it("lets an owner choose the channel the GitHub source follows", async () => {
      const user = userEvent.setup();
      await openPage();
      const mirror = within(screen.getByRole("region", { name: "Update mirror" }));
      await user.click(mirror.getByRole("radio", { name: "Built-in list" }));
      await user.click(mirror.getByRole("button", { name: "Save source" }));
      expect(
        await mirror.findByText(
          /GitHub source: Sneakers-PAM\/sneakers-appliance, the stable channel \(this build's default\)/,
        ),
      ).toBeInTheDocument();
      await user.click(mirror.getByRole("radio", { name: "Release candidates (rc)" }));
      await user.click(mirror.getByRole("button", { name: "Save source" }));
      await vi.waitFor(async () => {
        const after = await upgrade.get();
        expect(after.policy?.releaseChannel).toBe("rc");
        expect(after.mirrorStatus?.releaseChannel).toBe("rc");
      });
      expect(
        await mirror.findByText(
          /GitHub source: Sneakers-PAM\/sneakers-appliance, the rc channel, release v0\.2\.0-rc\.1/,
        ),
      ).toBeInTheDocument();
    });

    it("keeps the channel choice off a manual mirror", async () => {
      const user = userEvent.setup();
      await openPage();
      const mirror = within(screen.getByRole("region", { name: "Update mirror" }));
      await user.click(mirror.getByRole("radio", { name: "Manual" }));
      expect(mirror.queryByRole("radiogroup", { name: "GitHub channel" })).not.toBeInTheDocument();
    });

    it("hides the product when the box's backend doesn't report one", async () => {
      const { product, ...rest } = await upgrade.get();
      expect(product).toBeDefined();
      vi.spyOn(upgrade, "get").mockResolvedValue(rest as Awaited<ReturnType<typeof upgrade.get>>);
      await openPage();
      expect(screen.queryByRole("region", { name: "Product" })).not.toBeInTheDocument();
    });
  });

  describe("one file at a time", () => {
    it("cancels an upload under way: the box keeps nothing and Upload unlocks", async () => {
      applyMockScenario("uploading");
      const user = userEvent.setup();
      await openPage();
      await user.upload(screen.getByLabelText("Update .bin file"), binFile("signed release"));
      await user.click(screen.getByRole("button", { name: "Upload" }));
      expect(screen.getByRole("button", { name: "Upload" })).toBeDisabled();
      await user.click(await screen.findByRole("button", { name: "Cancel upload" }));
      // The box still says a file is coming in for one answer; the page asks again until it doesn't.
      await vi.waitFor(() => expect(screen.getByRole("button", { name: "Upload" })).toBeEnabled(), {
        timeout: 5000,
      });
      expect(screen.queryByRole("region", { name: "Verify result" })).not.toBeInTheDocument();
      const after = await upgrade.get();
      expect(after.heldUpload).toBeUndefined();
      expect(after.receiving).toBe(false);
    });

    it("locks Upload and Fetch while a file waits, and Cancel deletes it and unlocks them", async () => {
      const user = userEvent.setup();
      await openPage();
      await user.upload(screen.getByLabelText("Update .bin file"), binFile("signed release"));
      await user.click(screen.getByRole("button", { name: "Upload" }));
      const result = await panel();
      expect(within(result).getByRole("button", { name: "Verify and stage" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Upload" })).toBeDisabled();
      expect(screen.getByLabelText("Update .bin file")).toBeDisabled();
      const base = within(screen.getByRole("region", { name: "Base OS" }));
      const fetchButton = await base.findByRole("button", { name: "Fetch 0.2.0" });
      expect(fetchButton).toBeDisabled();
      expect(screen.getByText(/A file is waiting on the appliance/)).toBeInTheDocument();
      await user.click(within(result).getByRole("button", { name: "Cancel" }));
      await vi.waitFor(() => expect(screen.getByRole("button", { name: "Upload" })).toBeEnabled());
      expect(base.getByRole("button", { name: "Fetch 0.2.0" })).toBeEnabled();
      expect(screen.queryByRole("region", { name: "Verify result" })).not.toBeInTheDocument();
      const after = await upgrade.get();
      expect(after.heldUpload).toBeUndefined();
    });

    it("refuses a second upload while one waits, as the box does", async () => {
      applyMockScenario("held");
      await expect(upgrade.upload(binFile("signed release"))).rejects.toThrow(/UPGRADE_BUSY/);
      await expect(upgrade.fetch("sneakers-appliance-0.2.0-amd64.bin")).rejects.toThrow(
        /UPGRADE_BUSY/,
      );
    });

    it("shows the file the box holds after a reload, with Verify and Cancel", async () => {
      applyMockScenario("held");
      const user = userEvent.setup();
      await openPage();
      const result = await panel();
      expect(within(result).getByText(/Uploaded\. It hasn't been checked yet/)).toBeInTheDocument();
      expect(within(result).getByText("Full")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Upload" })).toBeDisabled();
      await user.click(within(result).getByRole("button", { name: "Verify and stage" }));
      expect(await screen.findByText("Verified")).toBeInTheDocument();
      await vi.waitFor(() => expect(screen.getByRole("button", { name: "Upload" })).toBeEnabled());
    });

    it("unlocks Upload once the file is verified and staged", async () => {
      const user = userEvent.setup();
      await openPage();
      await uploadAndVerify(user, binFile("signed release"));
      expect(await screen.findByText("Verified")).toBeInTheDocument();
      await vi.waitFor(() => expect(screen.getByRole("button", { name: "Upload" })).toBeEnabled());
    });
  });

  describe("cancelling a staged release", () => {
    it("unstages the base release after a confirm, with no code", async () => {
      applyMockScenario("staged");
      const user = userEvent.setup();
      await openPage();
      const base = within(screen.getByRole("region", { name: "Base OS" }));
      await user.click(base.getByRole("button", { name: "Cancel staged 0.2.0" }));
      const dialog = within(await screen.findByRole("dialog"));
      expect(dialog.getByText(/never boots/)).toBeInTheDocument();
      expect(dialog.queryByLabelText("Authenticator code")).not.toBeInTheDocument();
      await user.click(dialog.getByRole("button", { name: "Remove the staged release" }));
      expect(await screen.findByText("Other slot: empty")).toBeInTheDocument();
      expect(base.queryByRole("button", { name: /Apply/ })).not.toBeInTheDocument();
    });

    it("keeps the staged release when the confirm is dismissed", async () => {
      applyMockScenario("staged");
      const user = userEvent.setup();
      await openPage();
      await user.click(screen.getByRole("button", { name: "Cancel staged 0.2.0" }));
      await user.click(await screen.findByRole("button", { name: "Keep it staged" }));
      const after = await upgrade.get();
      expect(after.stagedVersion).toBe("0.2.0");
    });

    it("unstages the product bundle and keeps the installed one", async () => {
      applyMockScenario("product-staged");
      const user = userEvent.setup();
      await openPage();
      const product = within(screen.getByRole("region", { name: "Product" }));
      await user.click(product.getByRole("button", { name: "Cancel staged product 0.2.0" }));
      await user.click(
        within(await screen.findByRole("dialog")).getByRole("button", {
          name: "Remove the staged release",
        }),
      );
      expect(await product.findByText("Nothing staged")).toBeInTheDocument();
      expect(
        product.getByText("0.1.0", { selector: "[data-version=installed]" }),
      ).toBeInTheDocument();
    });
  });

  describe("the base range", () => {
    it("shows a product bundle refused for its base range with the range and the running base", async () => {
      applyMockScenario("product-range");
      const user = userEvent.setup();
      await openPage();
      await user.click(within(await panel()).getByRole("button", { name: "Verify and stage" }));
      const result = await panel();
      await vi.waitFor(() => expect(result).toHaveAttribute("data-tone", "danger"));
      expect(
        within(result).getByText(/needs base 9.0.0 or newer; this box runs 0.1.0/),
      ).toBeInTheDocument();
      expect(within(result).getByText("UPGRADE_PRODUCT_BASE")).toBeInTheDocument();
      await vi.waitFor(() => expect(screen.getByRole("button", { name: "Upload" })).toBeEnabled());
    });

    it("names each offered product version's base range", async () => {
      await openPage();
      const versions = within(await screen.findByRole("radiogroup", { name: "Product versions" }));
      expect(versions.getAllByText(/base 0.1.0 to 0.1.9/)).toHaveLength(2);
    });
  });

  it("puts the Base OS, Base Web and Product units in their own rows, each with its colour", async () => {
    await openPage();
    const cards = screen.getByTestId("unit-cards");
    expect(cards).toHaveClass("flex", "flex-col");
    const regions = within(cards)
      .getAllByRole("region")
      .filter((region) =>
        ["Base OS", "Base Web", "Product"].includes(region.getAttribute("aria-label") ?? ""),
      )
      .map((region) => region.getAttribute("aria-label"));
    expect(regions).toEqual(["Base OS", "Base Web", "Product"]);
    expect(
      within(screen.getByRole("region", { name: "Base OS" })).getByText("Reboots"),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "Base Web" })).getByText("No reboot"),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "Product" })).getByText("Restarts"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("card-base")).toHaveClass("border-t-primary");
    expect(screen.getByTestId("card-web")).toHaveClass("border-t-ok");
    expect(screen.getByTestId("card-product")).toHaveClass("border-t-sole");
    // Below them, the mirror, then the upload.
    const order = screen
      .getAllByRole("region")
      .map((region) => region.getAttribute("aria-label"))
      .filter((name) => name === "Update mirror" || name === "Install an update");
    expect(order).toEqual(["Update mirror", "Install an update"]);
  });
});
