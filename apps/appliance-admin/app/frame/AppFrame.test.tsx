import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";

import { AppFrame } from "@/frame/AppFrame";
import { status, upgrade } from "@/lib/osadmin/client";
import { setSession } from "@/lib/osadmin/sessionStore";
import { applyMockScenario } from "@/mock/edge.mock";

const stub = (start: string) => {
  const Stub = createRoutesStub([
    { Component: () => <p>Sign-in page</p>, path: "/" },
    {
      children: [
        { Component: () => <p>Status page</p>, path: "home" },
        { Component: () => <p>Network page</p>, path: "network" },
      ],
      Component: AppFrame,
    },
  ]);
  return render(<Stub initialEntries={[start]} />);
};

describe("AppFrame", () => {
  it("sends a signed-out visitor to sign-in", async () => {
    setSession(null);
    stub("/home");
    expect(await screen.findByText("Sign-in page")).toBeInTheDocument();
  });

  it("shows the page and the account menu once signed in", async () => {
    setSession({
      admin: "alice",
      csrfToken: "test-csrf",
      role: "ROLE_OWNER",
    });
    stub("/home");
    expect(await screen.findByText("Status page")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Account: alice/ })).toBeInTheDocument();
  });

  it("opens the appliance's own About and diagnostics, not the gateway-shaped one", async () => {
    setSession({
      admin: "alice",
      csrfToken: "test-csrf",
      role: "ROLE_OWNER",
    });
    const user = userEvent.setup();
    stub("/home");
    await screen.findByText("Status page");
    await user.click(screen.getByRole("button", { name: /Account: alice/ }));
    await user.click(await screen.findByText("About and diagnostics"));
    expect(
      await screen.findByText(`appliance-admin ${__APP_VERSION__} (${__APP_COMMIT__})`),
    ).toBeInTheDocument();
    expect(screen.getByText("alice (owner)")).toBeInTheDocument();
    expect(screen.queryByText(/gateway/i)).not.toBeInTheDocument();
  });

  it("shows a pending network change and its countdown on every page but Network", async () => {
    applyMockScenario("network-pending");
    setSession({ admin: "alice", csrfToken: "test-csrf", role: "ROLE_OWNER" });
    stub("/home");
    expect(
      await screen.findByText(
        /A network change \(net-7\) is waiting to be kept\. It reverts in 9\d seconds/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Network" })).toHaveAttribute("href", "/network");
  });

  it("leaves the pending change to the Network page's own banner there", async () => {
    applyMockScenario("network-pending");
    setSession({ admin: "alice", csrfToken: "test-csrf", role: "ROLE_OWNER" });
    stub("/network");
    expect(await screen.findByText("Network page")).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByText(/is waiting to be kept/)).not.toBeInTheDocument();
  });

  it("warns before a base update another admin started ends this session", async () => {
    const get = status.get.bind(status);
    vi.spyOn(status, "get").mockImplementation(async () => ({
      ...(await get()),
      upgradeProgress: {
        action: "apply",
        code: "",
        failed: false,
        inProgress: true,
        steps: [],
        target: "UPDATE_TARGET_BASE",
        version: "0.2.0",
      },
    }));
    setSession({ admin: "alice", csrfToken: "test-csrf", role: "ROLE_OWNER" });
    stub("/home");
    expect(await screen.findByText(/An update to 0\.2\.0 is under way/)).toBeInTheDocument();
    expect(screen.getByText(/every session ends, this one included/)).toBeInTheDocument();
  });

  it("tells the admin the box's notices after signing in", async () => {
    setSession({
      admin: "alice",
      csrfToken: "test-csrf",
      notices: ["Recover access was used on the console at 14:03."],
      role: "ROLE_OWNER",
    });
    stub("/home");
    expect(
      await screen.findByText("Recover access was used on the console at 14:03."),
    ).toBeInTheDocument();
  });

  it("shows Root shell in the nav to root operators only", async () => {
    // The sidebar shows at desktop width; at phone width it sits behind the menu button.
    vi.spyOn(globalThis, "matchMedia").mockImplementation(
      (query: string) =>
        ({
          addEventListener: () => {},
          addListener: () => {},
          dispatchEvent: () => false,
          matches: /min-width/.test(query),
          media: query,
          onchange: null,
          removeEventListener: () => {},
          removeListener: () => {},
        }) as MediaQueryList,
    );
    setSession({ admin: "alice", csrfToken: "c", role: "ROLE_OWNER", rootOperator: true });
    const { unmount } = stub("/home");
    expect(await screen.findByRole("link", { name: "Root shell" })).toBeInTheDocument();
    unmount();
    setSession({ admin: "carol", csrfToken: "c", role: "ROLE_ADMIN", rootOperator: false });
    stub("/home");
    await screen.findByText("Status page");
    expect(screen.queryByRole("link", { name: "Root shell" })).not.toBeInTheDocument();
  });

  describe("the base appliance and the product", () => {
    beforeEach(() => {
      vi.spyOn(globalThis, "matchMedia").mockImplementation(
        (query: string) =>
          ({
            addEventListener: () => {},
            addListener: () => {},
            dispatchEvent: () => false,
            matches: /min-width/.test(query),
            media: query,
            onchange: null,
            removeEventListener: () => {},
            removeListener: () => {},
          }) as MediaQueryList,
      );
      setSession({ admin: "alice", csrfToken: "c", role: "ROLE_OWNER" });
    });

    it("puts MCP in a section named after the installed product, not in the base nav", async () => {
      stub("/home");
      const productNav = await screen.findByRole("navigation", { name: "Sneakers" });
      expect(within(productNav).getByRole("link", { name: "MCP" })).toBeInTheDocument();
      const base = screen.getByRole("navigation", { name: "Appliance" });
      expect(within(base).queryByRole("link", { name: "MCP" })).not.toBeInTheDocument();
      expect(within(base).getByRole("link", { name: "Network" })).toBeInTheDocument();
    });

    it("names the section from the box, not from the nav", async () => {
      const real = upgrade.get;
      vi.spyOn(upgrade, "get").mockImplementation(async () => {
        const response = await real();
        return { ...response, product: { ...response.product, name: "Otherproduct" } };
      });
      stub("/home");
      const productNav = await screen.findByRole("navigation", { name: "Otherproduct" });
      expect(within(productNav).getByRole("link", { name: "MCP" })).toBeInTheDocument();
      expect(screen.queryByRole("navigation", { name: "Sneakers" })).not.toBeInTheDocument();
    });

    it("shows no product section and never mentions MCP with no product installed", async () => {
      applyMockScenario("no-product");
      const get = vi.spyOn(upgrade, "get");
      stub("/home");
      await screen.findByText("Status page");
      expect(await screen.findByRole("link", { name: "Network" })).toBeInTheDocument();
      await vi.waitFor(() => expect(get).toHaveBeenCalled());
      expect(screen.queryByRole("navigation", { name: "Sneakers" })).not.toBeInTheDocument();
      expect(screen.queryByText(/mcp/i)).not.toBeInTheDocument();
    });
  });
});
