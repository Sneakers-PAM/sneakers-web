import { render, screen, waitFor } from "@testing-library/react";

import type { UpgradeProgress } from "@/lib/osadmin/types";

import { BoxRestarting } from "@/components/BoxRestarting";
import { signIn, status } from "@/lib/osadmin/client";
import { OsadminError } from "@/lib/osadmin/errors";
import { boxAnswer } from "@/lib/osadmin/restart";

const session = { session: { admin: "alice" } } as Awaited<ReturnType<typeof signIn.getSession>>;
const signedOut = () => new OsadminError("unauthenticated", "ACCESS_SESSION: sign in first");

describe("boxAnswer", () => {
  it("tells a box still on this session from one that restarted and one that's down", async () => {
    const getSession = vi.spyOn(signIn, "getSession");
    getSession.mockResolvedValueOnce(session);
    expect(await boxAnswer()).toBe("session");
    getSession.mockRejectedValueOnce(signedOut());
    expect(await boxAnswer()).toBe("signed-out");
    getSession.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    expect(await boxAnswer()).toBe("down");
    getSession.mockRejectedValueOnce(new OsadminError("unknown", "osadmin answered 502"));
    expect(await boxAnswer()).toBe("down");
  });

  it("asks the public phase first: no phase answer means the box is down", async () => {
    vi.spyOn(signIn, "getSession").mockResolvedValue(session);
    vi.spyOn(status, "getPhase").mockRejectedValueOnce(new TypeError("Failed to fetch"));
    expect(await boxAnswer()).toBe("down");
  });
});

describe("BoxRestarting", () => {
  it("waits for the box to go down and come back, then goes on", async () => {
    vi.spyOn(signIn, "getSession")
      .mockResolvedValueOnce(session)
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockRejectedValue(signedOut());
    const onBack = vi.fn();
    render(<BoxRestarting onBack={onBack} pollMs={5} />);
    expect(screen.getByRole("heading", { name: "The box is restarting" })).toBeInTheDocument();
    expect(await screen.findByText(/down while it restarts/)).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "The box is back" })).toBeInTheDocument();
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("with waitForDownMs, doesn't take a signed-out answer for back before the box went down", async () => {
    vi.spyOn(signIn, "getSession").mockRejectedValue(signedOut());
    const onBack = vi.fn();
    render(<BoxRestarting onBack={onBack} pollMs={5} waitForDownMs={10_000} />);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.getByText(/Waiting for the box to go down/)).toBeInTheDocument();
    expect(onBack).not.toHaveBeenCalled();
  });

  it("with waitForDownMs, goes on once the box went down and came back signed out", async () => {
    vi.spyOn(signIn, "getSession")
      .mockRejectedValueOnce(signedOut())
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockRejectedValue(signedOut());
    const onBack = vi.fn();
    render(<BoxRestarting onBack={onBack} pollMs={5} waitForDownMs={10_000} />);
    expect(await screen.findByRole("heading", { name: "The box is back" })).toBeInTheDocument();
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("with waitForDownMs, goes on anyway once that long passed without seeing it go down", async () => {
    vi.spyOn(signIn, "getSession").mockRejectedValue(signedOut());
    const onBack = vi.fn();
    render(<BoxRestarting onBack={onBack} pollMs={5} waitForDownMs={30} />);
    expect(await screen.findByRole("heading", { name: "The box is back" })).toBeInTheDocument();
  });

  it("keeps waiting while the box still answers on the old session", async () => {
    vi.spyOn(signIn, "getSession").mockResolvedValue(session);
    const onBack = vi.fn();
    render(<BoxRestarting onBack={onBack} pollMs={5} />);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.getByText(/Waiting for the box to go down/)).toBeInTheDocument();
    expect(onBack).not.toHaveBeenCalled();
  });

  it("offers a reload when the box takes too long, instead of a dead page", async () => {
    vi.spyOn(signIn, "getSession").mockRejectedValue(new TypeError("Failed to fetch"));
    render(<BoxRestarting onBack={vi.fn()} pollMs={5} slowMs={20} />);
    expect(await screen.findByText("This is taking longer than usual")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
  });
});

const steps = (states: string[]): UpgradeProgress => {
  const ids = ["verify", "stage", "switch", "reboot", "health", "mark_good"];
  const labels = [
    "Verifying (signature, channel, SHA-256)",
    "Staging into slot B",
    "Switching slots",
    "Rebooting",
    "Checking health",
    "Marking good",
  ];
  return {
    action: "apply",
    code: "",
    failed: states.includes("FAILED"),
    inProgress: states.includes("ACTIVE"),
    steps: ids.map((id, index) => ({
      detail: "",
      doneBytes: "0",
      id,
      label: labels[index] ?? id,
      state:
        `UPGRADE_STEP_STATE_${states[index] ?? "PENDING"}` as UpgradeProgress["steps"][number]["state"],
      totalBytes: "0",
    })),
    version: "",
  };
};
const rebooting = steps(["DONE", "DONE", "DONE", "ACTIVE"]);
const checking = steps(["DONE", "DONE", "DONE", "DONE", "ACTIVE"]);
const marking = steps(["DONE", "DONE", "DONE", "DONE", "DONE", "ACTIVE"]);
const finished = steps(["DONE", "DONE", "DONE", "DONE", "DONE", "DONE"]);
const fellBack = steps(["DONE", "DONE", "DONE", "DONE", "FAILED"]);
const current = () =>
  screen.getAllByRole("listitem").find((item) => item.getAttribute("aria-current") === "step")
    ?.textContent;

describe("BoxRestarting with an update's steps", () => {
  it("shows rebooting while the box is down, then checking health and marking good once it answers, then goes on", async () => {
    vi.spyOn(status, "getPhase")
      .mockResolvedValueOnce({ phase: "normal", upgradeProgress: rebooting })
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce({ phase: "normal", upgradeProgress: checking })
      .mockResolvedValueOnce({ phase: "normal", upgradeProgress: marking })
      .mockResolvedValue({ phase: "normal", upgradeProgress: finished });
    vi.spyOn(signIn, "getSession").mockResolvedValueOnce(session).mockRejectedValue(signedOut());
    const onBack = vi.fn();
    render(<BoxRestarting onBack={onBack} pollMs={20} />);
    await waitFor(() => expect(current()).toMatch(/Rebooting/));
    await screen.findByText(/down while it restarts/);
    expect(current()).toMatch(/Rebooting/);
    await waitFor(() => expect(current()).toMatch(/Checking health/));
    expect(onBack).not.toHaveBeenCalled();
    await waitFor(() => expect(current()).toMatch(/Marking good/));
    await waitFor(() => expect(onBack).toHaveBeenCalledTimes(1));
  });

  it("stops on a failed step, says which, and offers to sign in instead of going on", async () => {
    vi.spyOn(status, "getPhase")
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValue({ phase: "normal", upgradeProgress: fellBack });
    vi.spyOn(signIn, "getSession").mockRejectedValue(signedOut());
    const onBack = vi.fn();
    render(<BoxRestarting onBack={onBack} pollMs={5} />);
    expect(
      await screen.findByRole("heading", { name: "The update didn't finish" }),
    ).toBeInTheDocument();
    const failed = screen.getAllByRole("listitem").find((item) => item.dataset.state === "failed");
    expect(failed).toHaveTextContent("Checking health");
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(onBack).not.toHaveBeenCalled();
  });
});

describe("BoxRestarting when the product failed to start", () => {
  const failedPhase = {
    failedPhase: "phase:identity",
    failedReason:
      "Starting sign-in, identity and the vault: sneakers/sneakers-vault-7c9 CrashLoopBackOff",
    phase: "normal",
    state: "failed",
  };

  it("stops waiting, says so with the phase and the reason, and names where to look", async () => {
    vi.spyOn(status, "getPhase")
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValue({ ...failedPhase, upgradeProgress: checking });
    vi.spyOn(signIn, "getSession").mockRejectedValue(signedOut());
    const onBack = vi.fn();
    render(<BoxRestarting onBack={onBack} pollMs={5} />);
    expect(
      await screen.findByRole("heading", { name: "Sneakers-PAM failed to start" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Starting sign-in, identity and the vault: sneakers/sneakers-vault-7c9 CrashLoopBackOff",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/Status, Logs/)).toBeInTheDocument();
    expect(screen.queryByText(/checks its health/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(onBack).not.toHaveBeenCalled();
  });

  it("says so while the box still answers on the old session, too", async () => {
    vi.spyOn(status, "getPhase").mockResolvedValue(failedPhase);
    vi.spyOn(signIn, "getSession").mockResolvedValue(session);
    render(<BoxRestarting onBack={vi.fn()} pollMs={5} />);
    expect(
      await screen.findByRole("heading", { name: "Sneakers-PAM failed to start" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Waiting for the box to go down/)).not.toBeInTheDocument();
  });
});
