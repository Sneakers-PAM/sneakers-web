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
const openFrame = (userId = "mock-user-alice") => {
  const cookie = sessionCookie(userId);
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

const BOX = { baseOS: "0.2.0", baseWeb: "0.2.0", fqdn: "box.example.org" };
const openMenu = async () => {
  await screen.findByText("Targets");
  await userEvent.setup().click(screen.getByRole("button", { name: /^Account:/ }));
  await screen.findByRole("menuitem", { name: "Sign out" });
};

describe("AdminFrame appliance admin link (#326)", () => {
  it("offers root the box's :8443 pages, in a new tab", async () => {
    mockAppliance.current = { ...mockAppliance.current, box: BOX };
    const open = vi.spyOn(globalThis, "open").mockReturnValue(null);
    openFrame("mock-user-carol");
    await openMenu();
    await userEvent.setup().click(screen.getByRole("menuitem", { name: "Appliance admin" }));
    expect(open).toHaveBeenCalledWith("https://box.example.org:8443/", "_blank", "noopener");
  });

  it("isn't there for a site admin who isn't root", async () => {
    mockAppliance.current = { ...mockAppliance.current, box: BOX };
    openFrame("mock-user-alice");
    await openMenu();
    expect(screen.queryByRole("menuitem", { name: "Appliance admin" })).toBeNull();
  });

  it("isn't there for root when the product doesn't run on a box", async () => {
    openFrame("mock-user-carol");
    await openMenu();
    expect(screen.queryByRole("menuitem", { name: "Appliance admin" })).toBeNull();
  });
});
