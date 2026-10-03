import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { RaciDecisionView } from "#shell/sharing/types";

import { RulesetSimulator } from "#shell/sharing/RulesetSimulator";

const DECISION: RaciDecisionView = {
  approve: false,
  approveReason: "requires read",
  informed: true,
  informedReason: "rule #2 allow group DB team",
  manage: false,
  manageReason: "requires read",
  read: false,
  readReason: "rule #1 deny user mock-user-dave",
  reveal: false,
  revealReason: "rule #1 deny user mock-user-dave",
};

const searchUsers = async (q: string) =>
  q.length >= 2
    ? [
        { id: "mock-user-dave", kind: "user" as const, name: "Dave" },
        { id: "mock-user-bob", kind: "user" as const, name: "Bob" },
      ].filter((u) => u.name.toLowerCase().includes(q.toLowerCase()))
    : [];

const pick = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
  await user.click(screen.getByRole("button", { name: "Pick a person" }));
  await user.type(screen.getByPlaceholderText("Search people"), name.slice(0, 3));
  await user.click(await screen.findByRole("option", { name: new RegExp(name) }));
};

describe("RulesetSimulator", () => {
  it("shows what the picked person would get, and why", async () => {
    const simulate = vi.fn(async () => DECISION);
    render(<RulesetSimulator searchUsers={searchUsers} simulate={simulate} />);
    const user = userEvent.setup();
    expect(
      screen.getByText("Pick someone to see what they would get, and why."),
    ).toBeInTheDocument();
    await pick(user, "Dave");
    expect(simulate).toHaveBeenCalledWith("mock-user-dave");
    expect(await screen.findByText("Reveal · No")).toBeInTheDocument();
    expect(screen.getAllByText("rule #1 deny user mock-user-dave")).toHaveLength(1);
    expect(screen.getByText("Informed · Yes")).toBeInTheDocument();
    expect(screen.getByText("rule #2 allow group DB team")).toBeInTheDocument();
    expect(screen.getByText("Approve · No")).toBeInTheDocument();
    expect(screen.getByText("Manage · No")).toBeInTheDocument();
  });

  it("runs again when the app hands it a new simulate, as the draft changes", async () => {
    const first = vi.fn(async () => DECISION);
    const { rerender } = render(<RulesetSimulator searchUsers={searchUsers} simulate={first} />);
    const user = userEvent.setup();
    await pick(user, "Dave");
    await screen.findByText("Reveal · No");
    const second = vi.fn(async () => ({
      ...DECISION,
      read: true,
      reveal: true,
      revealReason: "rule #1 allow user mock-user-dave",
    }));
    rerender(<RulesetSimulator searchUsers={searchUsers} simulate={second} />);
    expect(await screen.findByText("Reveal · Yes")).toBeInTheDocument();
    expect(second).toHaveBeenCalledWith("mock-user-dave");
  });

  it("says when the check failed, and tries again on Retry", async () => {
    const simulate = vi
      .fn<(id: string) => Promise<RaciDecisionView>>()
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValue(DECISION);
    render(<RulesetSimulator searchUsers={searchUsers} simulate={simulate} />);
    const user = userEvent.setup();
    await pick(user, "Bob");
    expect(await screen.findByText("Couldn't check Bob's access.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Reveal · No")).toBeInTheDocument();
  });
});
