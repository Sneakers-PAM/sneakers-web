import { render, screen, within } from "@testing-library/react";

import type { UpgradeProgress, UpgradeStep } from "@/lib/osadmin/types";

import { UpgradeSteps } from "@/components/UpgradeSteps";

const step = (
  id: string,
  label: string,
  state: UpgradeStep["state"],
  more: Partial<UpgradeStep> = {},
): UpgradeStep => ({
  detail: "",
  doneBytes: "0",
  id,
  label,
  state,
  totalBytes: "0",
  ...more,
});

const staging: UpgradeProgress = {
  action: "stage",
  code: "",
  failed: false,
  inProgress: true,
  steps: [
    step("verify", "Verifying (signature, channel, SHA-256)", "UPGRADE_STEP_STATE_DONE"),
    step("stage", "Staging into slot B", "UPGRADE_STEP_STATE_ACTIVE", {
      detail: "Writing the release into slot B.",
      doneBytes: "536870912",
      totalBytes: "1073741824",
    }),
    step("switch", "Switching slots", "UPGRADE_STEP_STATE_PENDING"),
    step("reboot", "Rebooting", "UPGRADE_STEP_STATE_PENDING"),
    step("health", "Checking health", "UPGRADE_STEP_STATE_PENDING"),
    step("mark_good", "Marking good", "UPGRADE_STEP_STATE_PENDING"),
  ],
  version: "0.2.0",
};

describe("UpgradeSteps", () => {
  it("lists every step in order, says where each stands and marks the current one", () => {
    render(<UpgradeSteps progress={staging} />);
    const items = within(screen.getByRole("list", { name: "Update steps" })).getAllByRole(
      "listitem",
    );
    expect(items.map((item) => item.dataset.state)).toEqual([
      "done",
      "active",
      "pending",
      "pending",
      "pending",
      "pending",
    ]);
    expect(items[0]).toHaveTextContent("Done");
    expect(items[1]).toHaveAttribute("aria-current", "step");
    expect(items[1]).toHaveTextContent("Staging into slot B");
    expect(items[1]).toHaveTextContent("Writing the release into slot B.");
    expect(items[2]).toHaveTextContent("To come");
  });

  it("shows the current step's progress where it has one", () => {
    render(<UpgradeSteps progress={staging} />);
    const bar = screen.getByRole("progressbar", { name: "Staging into slot B" });
    expect(bar).toHaveAttribute("value", "50");
    expect(screen.getByText("50% (512.0 MB of 1.0 GB)")).toBeInTheDocument();
  });

  it("says which step failed and why", () => {
    const failed: UpgradeProgress = {
      ...staging,
      code: "UPGRADE_SIGNATURE",
      failed: true,
      inProgress: false,
      steps: [
        step("verify", "Verifying (signature, channel, SHA-256)", "UPGRADE_STEP_STATE_FAILED", {
          detail: "UPGRADE_SIGNATURE (2505): the package isn't signed by this box's release key",
        }),
        ...staging.steps
          .slice(1)
          .map((s) => ({ ...s, detail: "", state: "UPGRADE_STEP_STATE_PENDING" as const })),
      ],
    };
    render(<UpgradeSteps progress={failed} />);
    const items = within(screen.getByRole("list", { name: "Update steps" })).getAllByRole(
      "listitem",
    );
    expect(items[0]).toHaveAttribute("data-state", "failed");
    expect(items[0]).toHaveTextContent("Failed");
    expect(items[0]).toHaveTextContent("isn't signed by this box's release key");
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
});
