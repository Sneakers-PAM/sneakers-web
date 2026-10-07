import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { applyMockScenario } from "@/mock/edge.mock";
import Status from "@/routes/status";
import { renderPage } from "@/test/renderPage";
import { signInAs } from "@/test/session";

describe("Status", () => {
  it("shows the version, protection and a TLS warning", async () => {
    renderPage(Status);
    expect(await screen.findByText("Status")).toBeInTheDocument();
    expect(await screen.findByText(/Running/)).toBeInTheDocument();
    expect(screen.getByText("Full")).toBeInTheDocument();
    expect(screen.getByText(/self-signed/)).toBeInTheDocument();
  });

  it("shows a factory reset waiting for its quorum", async () => {
    applyMockScenario("reset-pending");
    renderPage(Status);
    expect(await screen.findByText("A factory reset is pending")).toBeInTheDocument();
    expect(screen.getByText(/1 of 2 approved/)).toBeInTheDocument();
  });

  it("shows the factory reset's countdown with a Cancel any admin can press", async () => {
    applyMockScenario("reset-countdown");
    signInAs("bob");
    const user = userEvent.setup();
    renderPage(Status);
    expect(await screen.findByText(/Factory reset in/)).toBeInTheDocument();
    expect(screen.getByRole("timer")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel the factory reset" }));
    expect(await screen.findByText("The factory reset was cancelled.")).toBeInTheDocument();
    expect(screen.queryByRole("timer")).not.toBeInTheDocument();
  });
});
