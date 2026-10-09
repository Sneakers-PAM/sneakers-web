import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { StepUpDialog } from "@/components/StepUpDialog";
import { getSession } from "@/lib/osadmin/sessionStore";
import { requestStepUp } from "@/lib/osadmin/stepUpController";
import { signInAs } from "@/test/session";

describe("StepUpDialog", () => {
  it("is closed until something asks, then takes a fresh code and resumes the retry", async () => {
    signInAs("alice");
    const user = userEvent.setup();
    render(<StepUpDialog />);
    expect(screen.queryByText("Confirm it's you")).not.toBeInTheDocument();

    const retry = vi.fn();
    requestStepUp(retry);
    expect(await screen.findByText("Confirm it's you")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Authenticator code"), "654321");
    await user.click(screen.getByRole("button", { name: "Verify code" }));
    await vi.waitFor(() => expect(retry).toHaveBeenCalled());
    expect(screen.queryByText("Confirm it's you")).not.toBeInTheDocument();
    expect(getSession()?.stepUpUntil).toBeTruthy();
  });

  it("never labels its button Confirm, which a network change's own confirmation uses", async () => {
    signInAs("alice");
    render(<StepUpDialog />);
    requestStepUp(vi.fn());
    await screen.findByText("Confirm it's you");
    expect(screen.queryByRole("button", { name: "Confirm" })).not.toBeInTheDocument();
  });

  it("asks the retried action's follow-up in the same dialog, and runs it", async () => {
    signInAs("alice");
    const user = userEvent.setup();
    render(<StepUpDialog />);
    const run = vi.fn(() => Promise.resolve());
    requestStepUp(() =>
      Promise.resolve({
        body: "It reverts in 120 seconds unless it's kept.",
        confirmLabel: "Keep this change",
        dismissLabel: "Not now",
        run,
        title: "Keep this change?",
      }),
    );
    await user.type(await screen.findByLabelText("Authenticator code"), "654321");
    await user.click(screen.getByRole("button", { name: "Verify code" }));
    expect(await screen.findByText("Keep this change?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Keep this change" }));
    await vi.waitFor(() => expect(run).toHaveBeenCalled());
    await vi.waitFor(() => expect(screen.queryByText("Keep this change?")).not.toBeInTheDocument());
  });

  it("keeps the dialog up with the refusal when the code is wrong", async () => {
    signInAs("alice");
    const user = userEvent.setup();
    render(<StepUpDialog />);
    const retry = vi.fn();
    requestStepUp(retry);
    await user.type(await screen.findByLabelText("Authenticator code"), "000000");
    await user.click(screen.getByRole("button", { name: "Verify code" }));
    expect(await screen.findByText(/That code didn't work/)).toBeInTheDocument();
    expect(retry).not.toHaveBeenCalled();
  });
});
