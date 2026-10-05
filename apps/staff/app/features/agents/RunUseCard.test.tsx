import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { RunUse } from "@/features/agents/run.server";

import { RunUseCard } from "@/features/agents/RunUseCard";

const use = (over: Partial<RunUse> = {}): RunUse => ({
  clientLabel: "Sneakers MCP",
  command: "psql -h db1.example.org -U postgres_admin",
  expiresAt: Date.now() + 5 * 60_000,
  fieldKey: "password",
  id: "use-1",
  purpose: "Check the backup",
  requester: "laptop agent",
  reveal: false,
  secretName: "DB admin",
  ...over,
});

const show = (u: RunUse, { checked = true, expired = false, showPurpose = false } = {}) => {
  const onCheckedChange = vi.fn();
  render(
    <RunUseCard
      checked={checked}
      expired={expired}
      onCheckedChange={onCheckedChange}
      showPurpose={showPurpose}
      use={u}
    />,
  );
  return { card: screen.getByRole("group", { name: u.secretName }), onCheckedChange };
};

describe("a run's use card", () => {
  it("shows the field, the exact command and the time left, with no reveal badge", () => {
    const { card } = show(use());
    expect(within(card).getByText("password")).toBeInTheDocument();
    expect(within(card).getByText("psql -h db1.example.org -U postgres_admin")).toBeInTheDocument();
    expect(
      within(card).getByRole("timer", { name: /DB admin: \d+:\d\d left/ }),
    ).toBeInTheDocument();
    expect(within(card).queryByText("Reveals value to agent")).not.toBeInTheDocument();
    expect(within(card).queryByText(/Agent says/)).not.toBeInTheDocument();
  });

  it("flags a reveal to the agent in the danger tone", () => {
    const { card } = show(use({ command: "", reveal: true, secretName: "Status page API" }));
    expect(within(card).getByText("Reveal to the agent")).toBeInTheDocument();
    expect(within(card).getByText("Reveals value to agent")).toHaveClass("text-danger");
    expect(card).toHaveClass("bg-danger-soft");
  });

  it("reports the tick", async () => {
    const user = userEvent.setup();
    const { onCheckedChange } = show(use());
    await user.click(screen.getByRole("checkbox", { name: "Include DB admin" }));
    expect(onCheckedChange).toHaveBeenCalledWith(false);
  });

  it("unticks and greys out once expired", () => {
    const { card } = show(use({ reveal: true }), { expired: true });
    const box = screen.getByRole("checkbox", { name: "Include DB admin" });
    expect(box).not.toBeChecked();
    expect(box).toBeDisabled();
    expect(within(card).getByText("Expired")).toBeInTheDocument();
    expect(card).not.toHaveClass("bg-danger-soft");
    expect(card).toHaveClass("opacity-60");
  });

  it("shows its own task when asked, as the agent's words", () => {
    const { card } = show(use(), { showPurpose: true });
    expect(card).toHaveTextContent("Agent says: Check the backup");
  });
});
