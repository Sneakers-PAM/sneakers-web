import { render, screen } from "@testing-library/react";

import { StepUpDialog } from "@/components/StepUpDialog";
import { requestStepUp } from "@/lib/osadmin/stepUpController";

describe("StepUpDialog", () => {
  it("is closed until something requests a step-up, then resumes the retry on approval", async () => {
    render(<StepUpDialog />);
    expect(screen.queryByText("Sign in again to continue")).not.toBeInTheDocument();

    const retry = vi.fn();
    requestStepUp(retry);
    expect(await screen.findByText("Sign in again to continue")).toBeInTheDocument();
    await screen.findByText(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);

    // The mock transport approves on the second poll (every 2s); allow real time to pass.
    await vi.waitFor(() => expect(retry).toHaveBeenCalled(), { timeout: 6000 });
    expect(screen.queryByText("Sign in again to continue")).not.toBeInTheDocument();
  }, 10_000);
});
