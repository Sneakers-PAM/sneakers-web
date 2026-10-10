import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { status, upgrade } from "@/lib/osadmin/client";
import { applyMockScenario } from "@/mock/edge.mock";
import * as world from "@/mock/world";
import Home from "@/routes/home";
import { renderPage } from "@/test/renderPage";
import { signInAs } from "@/test/session";

/** The paragraph whose whole text is `text`. */
const line = (text: RegExp | string) =>
  screen.getByText(
    (_, element) =>
      element?.tagName === "P" &&
      (typeof text === "string" ? element.textContent === text : text.test(element.textContent)),
  );

describe("Home", () => {
  it("shows the version, protection and a TLS warning", async () => {
    renderPage(Home);
    expect(await screen.findByText("Status")).toBeInTheDocument();
    expect(await screen.findByText(/Running/)).toBeInTheDocument();
    expect(screen.getByText("Full")).toBeInTheDocument();
    expect(screen.getByText(/self-signed/)).toBeInTheDocument();
  });

  it("says when the last network change was undone, once, without the raw warning", async () => {
    applyMockScenario("network-reverted");
    renderPage(Home);
    expect(
      await screen.findAllByText(/The last network change \(net-6\) wasn't kept/),
    ).not.toHaveLength(0);
    expect(screen.getAllByText(/before its window ended/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/wasn't confirmed and was undone/)).not.toBeInTheDocument();
  });

  it("lists the product's exposed values, and shows one only on Show", async () => {
    signInAs("bob");
    const user = userEvent.setup();
    renderPage(Home);
    const panel = within(await screen.findByRole("region", { name: "Product values" }));
    expect(panel.getByText("Sneakers setup token")).toBeInTheDocument();
    expect(panel.queryByText(world.MOCK_SETUP_TOKEN)).not.toBeInTheDocument();
    await user.click(panel.getByRole("button", { name: "Show Sneakers setup token" }));
    expect(await panel.findByText(world.MOCK_SETUP_TOKEN)).toBeInTheDocument();
    expect(panel.getByRole("link", { name: /admin\/setup/ })).toHaveAttribute(
      "href",
      "https://appliance.example.org/admin/setup",
    );
    expect(panel.getByText(/the box doesn't show it again/)).toBeInTheDocument();
  });

  it("says a one-time product value is already used, with nothing to show", async () => {
    applyMockScenario("setup-token-used");
    renderPage(Home);
    const panel = within(await screen.findByRole("region", { name: "Product values" }));
    expect(panel.getByText(/Sneakers is already set up/)).toBeInTheDocument();
    expect(panel.queryByRole("button", { name: /^Show/ })).not.toBeInTheDocument();
  });

  it("has no product values panel with no product installed", async () => {
    applyMockScenario("no-product");
    renderPage(Home);
    await screen.findByText(/Running/);
    expect(screen.queryByRole("region", { name: "Product values" })).not.toBeInTheDocument();
  });

  it("wraps the TLS fingerprint instead of letting it run off the card", async () => {
    renderPage(Home);
    const fingerprint = await screen.findByText(/^Fingerprint: /);
    expect(fingerprint.className).toContain("break-all");
  });

  it("shows the running and staged versions as their own build name, each with its channel", async () => {
    applyMockScenario("staged");
    renderPage(Home);
    const running = await screen.findByText("0.1.0", { selector: "[data-version=running]" });
    expect(running).toBeInTheDocument();
    expect(line(/^In the active slot, on /)).toBeInTheDocument();
    const staged = screen.getByText("0.2.0", { selector: "[data-version=staged]" });
    expect(staged).toBeInTheDocument();
    expect(screen.getAllByText("Stable").length).toBeGreaterThanOrEqual(2);
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

  it("names the release kept in the other slot for a revert", async () => {
    renderPage(Home);
    expect(await screen.findByText("Other slot: 0.0.9 (revert target)")).toBeInTheDocument();
  });

  it("says nothing of a revert target while a release is staged", async () => {
    applyMockScenario("staged");
    renderPage(Home);
    expect(await screen.findByText("Status")).toBeInTheDocument();
    expect(screen.getByText("0.2.0", { selector: "[data-version=staged]" })).toBeInTheDocument();
    expect(screen.queryByText(/revert target/)).not.toBeInTheDocument();
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

  it("shows the product install's own steps on Status, the same as Updates", async () => {
    applyMockScenario("product-staged");
    signInAs("alice");
    await upgrade.apply("123456", undefined, "UPDATE_TARGET_PRODUCT");
    renderPage(Home);
    const progress = within(await screen.findByRole("region", { name: "Update progress" }));
    expect(progress.getByText("Updating to 0.2.0")).toBeInTheDocument();
    expect(await progress.findByRole("list", { name: "Update steps" })).toBeInTheDocument();
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
