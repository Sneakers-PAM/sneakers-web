import { sessionCookie, withCookie, withMockGateway } from "@sneakers-web/mock-gateway/testing";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";

import { StepUpDialog, useStepUp } from "#shell/auth/StepUpDialog";
import { stepUpAction } from "#shell/server/stepUp.server";

withMockGateway();

const Page = ({ onRetry }: { onRetry: () => void }) => {
  const stepUp = useStepUp();
  return (
    <>
      <button onClick={() => stepUp.ask(onRetry)} type="button">
        Reveal
      </button>
      <StepUpDialog {...stepUp.dialog} confirmLabel="Reveal value">
        <p>Field: password</p>
      </StepUpDialog>
    </>
  );
};

const stub = async (onRetry: () => void) => {
  const cookie = sessionCookie("mock-user-alice");
  const Stub = createRoutesStub([
    { Component: () => <Page onRetry={onRetry} />, path: "/" },
    { action: withCookie(cookie, stepUpAction as never) as never, path: "/resources/step-up" },
  ]);
  render(<Stub initialEntries={["/"]} />);
};

describe("StepUpDialog", () => {
  it("marks a wrong code, then retries the refused call once the right code checks out", async () => {
    const onRetry = vi.fn();
    await stub(onRetry);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Reveal" }));
    expect(screen.getByRole("heading", { name: "Confirm it's you" })).toBeInTheDocument();
    expect(screen.getByText("Field: password")).toBeInTheDocument();

    await user.type(screen.getByLabelText("6-digit code"), "000000");
    expect(await screen.findByText(/That code didn.t work/)).toBeInTheDocument();
    expect(onRetry).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText("6-digit code"));
    await user.type(screen.getByLabelText("6-digit code"), "481027");
    await vi.waitFor(() => expect(onRetry).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("heading", { name: "Confirm it's you" })).not.toBeInTheDocument();
  });

  it("closes without retrying on Cancel", async () => {
    const onRetry = vi.fn();
    await stub(onRetry);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Reveal" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("heading", { name: "Confirm it's you" })).not.toBeInTheDocument();
    expect(onRetry).not.toHaveBeenCalled();
  });

  it("asks for an emailed code when Email is picked", async () => {
    await stub(vi.fn());
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Reveal" }));
    await user.click(screen.getByRole("radio", { name: "Email" }));
    expect(await screen.findByText(/We emailed you a code/)).toBeInTheDocument();
  });
});
