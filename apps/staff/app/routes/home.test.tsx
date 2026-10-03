import { MOCK_GATEWAY_URL, mockState } from "@sneakers-web/mock-gateway";
import { server, withMockGateway } from "@sneakers-web/mock-gateway/testing";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse } from "msw";
import { graphql } from "msw/graphql";

import * as home from "@/routes/home";
import { renderRoute } from "@/test/routeStub";

withMockGateway();

const api = graphql.link(`${MOCK_GATEWAY_URL}/graphql`);
const route = { Component: home.default, loader: home.loader, path: "/" };

const refuse = (code: string, reason?: string) =>
  server.use(
    api.query("DashboardHome", () =>
      HttpResponse.json({
        errors: [{ extensions: { code, reason }, message: `rpc error: code = X desc = ${code}` }],
      }),
    ),
  );

const tile = (name: RegExp) => screen.getByRole("link", { name });

describe("the dashboard", () => {
  it("greets Alice and links each stat tile to its drill-down", async () => {
    renderRoute("/", route);
    expect(await screen.findByRole("heading", { level: 1, name: /, Alice$/ })).toBeInTheDocument();
    expect(screen.getByText(/^2 things need you\./)).toBeInTheDocument();
    expect(tile(/Accessible 10 secrets you can see/)).toHaveAttribute(
      "href",
      "/secrets?status=all",
    );
    expect(tile(/Expiring soon 2 within 30 days/)).toHaveAttribute(
      "href",
      "/secrets?status=expiring",
    );
    expect(tile(/Expired 1 past due/)).toHaveAttribute("href", "/secrets?status=expired");
    expect(tile(/Drift 2 failed heartbeat/)).toHaveAttribute("href", "/secrets?status=drift");
  });

  it("shows the agent waiting and the checkout, with a way to act on each", async () => {
    renderRoute("/", route);
    const agent = await screen.findByRole("region", { name: "Agent is waiting" });
    expect(
      within(agent).getByText("psql -h db1.example.org -U postgres_admin"),
    ).toBeInTheDocument();
    expect(
      within(agent).getByText(/DB admin · password · Build agent on build1/),
    ).toBeInTheDocument();
    expect(within(agent).getByRole("link", { name: "Review" })).toHaveAttribute(
      "href",
      "/approvals",
    );
    const checkout = screen.getByRole("region", { name: "Acme VPN is checked out" });
    expect(within(checkout).getByRole("link", { name: "Check in" })).toHaveAttribute(
      "href",
      "/checkouts",
    );
    expect(screen.queryByRole("region", { name: "Your request is pending" })).toBeNull();
  });

  it("lists the five most-opened secrets, each linking to its page", async () => {
    renderRoute("/", route);
    const top = await screen.findByRole("region", { name: /Top accessed secrets/ });
    const links = within(top).getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual([
      "Status page API",
      "Acme VPN",
      "DB admin",
      "Build host deploy key",
      "Payroll portal",
    ]);
    expect(links[1]).toHaveAttribute("href", "/secret/mock-secret-acme-vpn");
    expect(within(top).getByText("Platform / Network")).toBeInTheDocument();
    expect(within(top).getByText("57 views")).toBeInTheDocument();
  });

  it("shows Bob his pending request", async () => {
    renderRoute("/", route, { user: "mock-user-bob" });
    const card = await screen.findByRole("region", { name: "Your request is pending" });
    expect(within(card).getByText(/Platform \/ Network/)).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: "View" })).toHaveAttribute("href", "/requests");
  });

  it("walks a new user through getting started when there's nothing to show", async () => {
    mockState.world.secrets = [];
    mockState.world.leases = [];
    mockState.world.secretUses = [];
    renderRoute("/", route);
    expect(
      await screen.findByRole("heading", { level: 1, name: "Welcome, Alice" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Your vault is empty for now. Here is how to start."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Save your first secret/ })).toHaveAttribute(
      "href",
      "/secret/new",
    );
    expect(screen.getByText("No access history yet")).toBeInTheDocument();
    expect(tile(/Accessible 0/)).toBeInTheDocument();
  });

  it("offers Retry when the gateway can't answer, and recovers", async () => {
    refuse("UNAVAILABLE");
    const user = userEvent.setup();
    renderRoute("/", route);
    expect(await screen.findByText("Couldn't load your dashboard")).toBeInTheDocument();
    server.resetHandlers();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("link", { name: /Accessible 10/ })).toBeInTheDocument();
  });

  it("says why when the gateway refuses, without a pointless Retry", async () => {
    refuse("PERMISSION_DENIED", "NOT_SITE_ADMIN");
    renderRoute("/", route);
    expect(await screen.findByText("Only a site admin can do that.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });
});
