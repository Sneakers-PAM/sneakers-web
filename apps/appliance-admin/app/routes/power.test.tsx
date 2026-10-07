import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import Power from "@/routes/power";
import { renderPage } from "@/test/renderPage";

describe("Power", () => {
  it("shows the active session and keeps the factory reset flow unavailable", async () => {
    renderPage(Power);
    expect(await screen.findByText("Power")).toBeInTheDocument();
    expect(screen.getByText(/alice from 192.0.2.10/)).toBeInTheDocument();
    expect(screen.getByText("Factory reset: not available in this release")).toBeInTheDocument();
  });

  it("reboots gracefully by default", async () => {
    const user = userEvent.setup();
    renderPage(Power);
    await screen.findByText("Power");
    await user.click(screen.getByRole("button", { name: "Reboot" }));
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    expect(await screen.findByText(/Rebooting/)).toBeInTheDocument();
  });

  it("needs the second explicit confirmation to force a shutdown", async () => {
    const user = userEvent.setup();
    renderPage(Power);
    await screen.findByText("Power");
    await user.click(screen.getByRole("button", { name: "Shut down" }));
    await user.click(screen.getByRole("switch", { name: "Force (skip the drain)" }));
    expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
    await user.click(screen.getByText(/I understand sessions will be cut/));
    expect(screen.getByRole("button", { name: "Confirm" })).not.toBeDisabled();
  });
});
