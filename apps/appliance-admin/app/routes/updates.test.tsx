import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { upgrade } from "@/lib/osadmin/client";
import { OsadminError } from "@/lib/osadmin/errors";
import { cancelStepUp, stepUpPending } from "@/lib/osadmin/stepUpController";
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

const uploadAndVerify = async (user: ReturnType<typeof userEvent.setup>, file: File) => {
  await user.upload(screen.getByLabelText("Update .bin file"), file);
  await user.click(screen.getByRole("button", { name: "Upload" }));
  await user.click(await screen.findByRole("button", { name: "Verify and stage" }));
};

describe("Updates", () => {
  beforeEach(() => signInAs("alice"));

  it("shows the running version, the other slot, the update window and the history", async () => {
    await openPage();
    expect(screen.getByText("Running 0.1.0 in the active slot")).toBeInTheDocument();
    expect(screen.getByText(/Other slot: empty/)).toBeInTheDocument();
    expect(screen.getByText(/Daily at 02:00 for 120 minutes/)).toBeInTheDocument();
    const history = screen.getByRole("table", { name: "Update history" });
    expect(within(history).getAllByRole("row").length).toBeGreaterThan(1);
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
    expect(within(result).getByText(/Signature: verified/)).toBeInTheDocument();
    expect(within(result).getByText(/Channel: stable/)).toBeInTheDocument();
    expect(within(result).getByText(/SHA-256: [0-9a-f]{64}/)).toBeInTheDocument();
    expect(within(result).getByText(/full release 0.2.0/)).toBeInTheDocument();
    expect(await screen.findByText(/Other slot: staged 0.2.0/)).toBeInTheDocument();
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
    expect(screen.getByText(/Other slot: empty/)).toBeInTheDocument();
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

  it("applies the staged release only after its version is typed", async () => {
    applyMockScenario("staged");
    const user = userEvent.setup();
    await openPage();
    await user.click(screen.getByRole("button", { name: "Apply 0.2.0" }));
    const dialog = await screen.findByRole("dialog");
    const confirm = within(dialog).getByRole("button", { name: "Apply and reboot" });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByLabelText("Type 0.2.0 to confirm"), "0.2.0");
    expect(confirm).not.toBeDisabled();
    await user.click(confirm);
    expect(await screen.findByText(/Applying 0.2.0/)).toBeInTheDocument();
  });

  it("asks for a fresh sign-in when the apply needs a step-up", async () => {
    applyMockScenario("staged");
    applyMockScenario("stepup");
    const user = userEvent.setup();
    await openPage();
    await user.click(screen.getByRole("button", { name: "Apply 0.2.0" }));
    await user.type(screen.getByLabelText("Type 0.2.0 to confirm"), "0.2.0");
    await user.click(screen.getByRole("button", { name: "Apply and reboot" }));
    await vi.waitFor(() => expect(stepUpPending()).toBe(true));
    cancelStepUp();
  });

  it("reverts to the other slot after a confirmation", async () => {
    const user = userEvent.setup();
    await openPage();
    await user.click(screen.getByRole("button", { name: "Revert to the other slot" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Revert and reboot" }));
    expect(await screen.findByText(/Reverting to the other slot/)).toBeInTheDocument();
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

  it("shows a non-owner the state but no install actions", async () => {
    signInAs("bob");
    await openPage();
    expect(
      screen.getByText("Only an owner can install, apply or revert updates."),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Update .bin file")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Revert to the other slot" }),
    ).not.toBeInTheDocument();
  });
});
