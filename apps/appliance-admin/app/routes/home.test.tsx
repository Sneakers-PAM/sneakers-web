import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { status } from "@/lib/osadmin/client";
import { applyMockScenario } from "@/mock/edge.mock";
import Home from "@/routes/home";
import { renderPage } from "@/test/renderPage";
import { signInAs } from "@/test/session";

describe("Home", () => {
  it("shows the version, protection and a TLS warning", async () => {
    renderPage(Home);
    expect(await screen.findByText("Status")).toBeInTheDocument();
    expect(await screen.findByText(/Running/)).toBeInTheDocument();
    expect(screen.getByText("Full")).toBeInTheDocument();
    expect(screen.getByText(/self-signed/)).toBeInTheDocument();
  });

  it("renders without warnings or health when the box leaves them out of the reply", async () => {
    // A box with nothing to warn about and no dependency to report leaves both repeated
    // fields out entirely (an empty repeated field isn't sent), unlike the mock, which
    // always fills them in.
    const { health, warnings, ...rest } = await status.get();
    expect(health?.length).toBeGreaterThan(0);
    expect(warnings?.length).toBeGreaterThan(0);
    vi.spyOn(status, "get").mockResolvedValueOnce(rest as Awaited<ReturnType<typeof status.get>>);
    renderPage(Home);
    expect(await screen.findByText("Status")).toBeInTheDocument();
    expect(screen.getByText(/Running/)).toBeInTheDocument();
  });

  it("shows a revert an admin asked for as reverted, in a neutral tone, not as failed", async () => {
    applyMockScenario("reverted");
    renderPage(Home);
    const line = await screen.findByText(/Reverted from 0.2.0/);
    expect(line).toHaveTextContent(/Reverted from 0.2.0 \(by alice, .+\)/);
    expect(line).not.toHaveClass("text-danger");
    expect(screen.queryByText(/Failed:/)).not.toBeInTheDocument();
  });

  it("keeps Failed for a boot-counting fallback", async () => {
    applyMockScenario("failed");
    renderPage(Home);
    expect(await screen.findByText("Failed: 0.2.0")).toHaveClass("text-danger");
  });

  it("shows a factory reset waiting for its quorum", async () => {
    applyMockScenario("reset-pending");
    renderPage(Home);
    expect(await screen.findByText("A factory reset is pending")).toBeInTheDocument();
    expect(screen.getByText(/1 of 2 approved/)).toBeInTheDocument();
  });

  it("shows the factory reset's countdown with a Cancel any admin can press", async () => {
    applyMockScenario("reset-countdown");
    signInAs("bob");
    const user = userEvent.setup();
    renderPage(Home);
    expect(await screen.findByText(/Factory reset in/)).toBeInTheDocument();
    expect(screen.getByRole("timer")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel the factory reset" }));
    expect(await screen.findByText("The factory reset was cancelled.")).toBeInTheDocument();
    expect(screen.queryByRole("timer")).not.toBeInTheDocument();
  });
});
