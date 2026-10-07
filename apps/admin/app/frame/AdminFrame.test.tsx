import { mockAppliance } from "@sneakers-web/mock-gateway";
import { sessionCookie, withCookie, withMockGateway } from "@sneakers-web/mock-gateway/testing";
import { ProblemActions } from "@sneakers-web/shell";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";

import { AdminFrame } from "@/frame/AdminFrame";
import { loader as frameLoader } from "@/routes/frame";

withMockGateway();

/** Mounts the real admin frame, with its real loader run against the mock gateway. */
const openFrame = () => {
  const cookie = sessionCookie("mock-user-alice");
  const Stub = createRoutesStub([
    {
      children: [{ Component: () => <h1>Targets</h1>, index: true }],
      Component: () => (
        <ProblemActions>
          <AdminFrame />
        </ProblemActions>
      ),
      id: "routes/frame",
      loader: withCookie(cookie, frameLoader),
    },
  ]);
  return render(<Stub initialEntries={["/"]} />);
};

describe("AdminFrame appliance banners", () => {
  it("shows neither banner on a plain install", async () => {
    openFrame();
    await screen.findByText("Targets");
    expect(screen.queryByRole("status", { name: "MCP status" })).toBeNull();
    expect(screen.queryByRole("status", { name: "Maintenance mode" })).toBeNull();
  });

  it("shows the MCP-off notice when the appliance says the MCP is off", async () => {
    mockAppliance.current = { ...mockAppliance.current, mcp: "off" };
    openFrame();
    expect(await screen.findByRole("status", { name: "MCP status" })).toHaveTextContent(
      "MCP: off.",
    );
    expect(screen.queryByRole("status", { name: "Maintenance mode" })).toBeNull();
  });

  it("shows the maintenance banner and reason when the appliance is in maintenance", async () => {
    mockAppliance.current = {
      ...mockAppliance.current,
      maintenance: true,
      maintenanceReason: "Upgrading to v2.0",
    };
    openFrame();
    expect(await screen.findByRole("status", { name: "Maintenance mode" })).toHaveTextContent(
      "Upgrading to v2.0",
    );
    expect(screen.queryByRole("status", { name: "MCP status" })).toBeNull();
  });
});

describe("AdminFrame user menu", () => {
  it("opens without locking the body's scroll, so it can't shift the page", async () => {
    openFrame();
    await screen.findByText("Targets");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /^Account:/ }));
    await screen.findByRole("menuitem", { name: "Sign out" });
    expect(document.body).not.toHaveAttribute("data-scroll-locked");
    expect(document.body.style.paddingRight).toBe("");
  });

  it("offers the staff-site link from the user menu on a phone", async () => {
    openFrame();
    await screen.findByText("Targets");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /^Account:/ }));
    expect(await screen.findByRole("menuitem", { name: "User app" })).toBeInTheDocument();
  });

  it("links back to the staff site from the header, built from the configured URL, at desktop width", async () => {
    const original = globalThis.matchMedia;
    globalThis.matchMedia = ((query: string) => ({
      addEventListener: () => {},
      addListener: () => {},
      dispatchEvent: () => false,
      matches: query.includes("min-width"),
      media: query,
      onchange: null,
      removeEventListener: () => {},
      removeListener: () => {},
    })) as typeof globalThis.matchMedia;
    try {
      openFrame();
      await screen.findByRole("heading", { level: 1, name: "Targets" });
      expect(screen.getByRole("link", { name: /User app/ })).toHaveAttribute("href", "/");
    } finally {
      globalThis.matchMedia = original;
    }
  });
});
