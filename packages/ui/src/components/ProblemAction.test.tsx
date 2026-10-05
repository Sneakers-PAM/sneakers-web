import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Alert } from "#ui/components/Feedback";
import { ProblemActionProvider, setToastProblemAction } from "#ui/components/ProblemAction";
import { toast, Toaster } from "#ui/components/Toast";

describe("the problem action", () => {
  afterEach(() => setToastProblemAction(null));

  it("puts Copy diagnostics on danger and warning alerts, with the alert's message", async () => {
    const run = vi.fn();
    render(
      <ProblemActionProvider value={{ label: "Copy diagnostics", run }}>
        <Alert tone="danger">That item no longer exists.</Alert>
        <Alert title="Rotation is late" tone="warn" />
        <Alert tone="info">All good.</Alert>
        <Alert tone="ok">Saved.</Alert>
      </ProblemActionProvider>,
    );
    const buttons = screen.getAllByRole("button", { name: "Copy diagnostics" });
    expect(buttons).toHaveLength(2);
    await userEvent.click(buttons[0]!);
    expect(run).toHaveBeenCalledWith("That item no longer exists.");
    await userEvent.click(buttons[1]!);
    expect(run).toHaveBeenLastCalledWith("Rotation is late");
  });

  it("leaves alerts alone without a provider", () => {
    render(<Alert tone="danger">Broken.</Alert>);
    expect(screen.queryByRole("button", { name: "Copy diagnostics" })).toBeNull();
  });

  it("offers it on error toasts, not on plain ones", async () => {
    const run = vi.fn();
    setToastProblemAction({ label: "Copy diagnostics", run });
    render(<Toaster />);
    act(() => {
      toast("Copied.");
      toast.error("A service behind the gateway isn't answering.");
    });
    const button = await screen.findByRole("button", { name: "Copy diagnostics" });
    expect(screen.getAllByRole("button", { name: "Copy diagnostics" })).toHaveLength(1);
    // A plain click: sonner's swipe handling needs pointer capture, which jsdom lacks.
    fireEvent.click(button);
    expect(run).toHaveBeenCalledWith("A service behind the gateway isn't answering.");
  });
});
