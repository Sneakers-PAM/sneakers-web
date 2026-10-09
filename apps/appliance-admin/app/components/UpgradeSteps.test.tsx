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

const productInstall = (steps: UpgradeStep[]): UpgradeProgress => ({
  action: "apply",
  code: "",
  failed: false,
  inProgress: true,
  steps,
  target: "UPDATE_TARGET_PRODUCT",
  version: "0.2.0",
});

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

  it("reads a product install's steps from their own state, not the order they come in, when a pod falls over", () => {
    // "pods" went done, "edge" started, then a pod fell over: pods is active again and edge is
    // back to pending, even though pods comes before edge in the list (sneakers-appliance#218).
    const { rerender } = render(
      <UpgradeSteps
        progress={productInstall([
          step("k0s", "Starting k0s", "UPGRADE_STEP_STATE_DONE"),
          step("images", "Pulling the product's images", "UPGRADE_STEP_STATE_DONE"),
          step("manifests", "Applying the product's manifests", "UPGRADE_STEP_STATE_DONE"),
          step("pods", "Waiting for the product's pods", "UPGRADE_STEP_STATE_ACTIVE", {
            detail: "3 of 5 pods ready",
          }),
          step("edge", "Opening the product on 443", "UPGRADE_STEP_STATE_PENDING"),
        ])}
      />,
    );
    expect(screen.getByText("3 of 5 pods ready")).toBeInTheDocument();
    rerender(
      <UpgradeSteps
        progress={productInstall([
          step("k0s", "Starting k0s", "UPGRADE_STEP_STATE_DONE"),
          step("images", "Pulling the product's images", "UPGRADE_STEP_STATE_DONE"),
          step("manifests", "Applying the product's manifests", "UPGRADE_STEP_STATE_DONE"),
          step("pods", "Waiting for the product's pods", "UPGRADE_STEP_STATE_ACTIVE", {
            detail: "4 of 5 pods ready (1 restarting)",
          }),
          step("edge", "Opening the product on 443", "UPGRADE_STEP_STATE_PENDING"),
        ])}
      />,
    );
    const items = screen.getAllByRole("listitem");
    const pods = items.find((item) => item.dataset.state === "active");
    expect(pods).toHaveTextContent("4 of 5 pods ready (1 restarting)");
    const edge = items.find((item) => item.textContent?.startsWith("Opening the product"));
    expect(edge?.dataset.state).toBe("pending");
  });

  it("shows a product install step's failure the same way, without a code", () => {
    render(
      <UpgradeSteps
        progress={productInstall([
          step("k0s", "Starting k0s", "UPGRADE_STEP_STATE_DONE"),
          step("images", "Pulling the product's images", "UPGRADE_STEP_STATE_DONE"),
          step("manifests", "Applying the product's manifests", "UPGRADE_STEP_STATE_DONE"),
          step("pods", "Waiting for the product's pods", "UPGRADE_STEP_STATE_DONE"),
          step("edge", "Opening the product on 443", "UPGRADE_STEP_STATE_FAILED", {
            detail: "The product didn't open on 443 in time.",
          }),
        ])}
      />,
    );
    const failed = within(
      screen.getAllByRole("listitem").find((item) => item.dataset.state === "failed")!,
    );
    expect(failed.getByText("The product didn't open on 443 in time.")).toBeInTheDocument();
    expect(failed.getByText("Failed")).toBeInTheDocument();
  });
});
