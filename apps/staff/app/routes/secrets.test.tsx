import { MOCK_GATEWAY_URL, mockState } from "@sneakers-web/mock-gateway";
import { server, withMockGateway } from "@sneakers-web/mock-gateway/testing";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse } from "msw";
import { graphql } from "msw/graphql";

import * as secrets from "@/routes/secrets";
import { renderRoute } from "@/test/routeStub";

withMockGateway();

const api = graphql.link(`${MOCK_GATEWAY_URL}/graphql`);
const route = {
  Component: secrets.default,
  loader: secrets.loader,
  path: "/secrets",
};

const names = () =>
  within(screen.getByRole("table"))
    .getAllByRole("link")
    .map((l) => l.textContent);

describe("secrets by status", () => {
  it("lists the expiring secrets with type, folder, expiry and heartbeat", async () => {
    renderRoute("/secrets?status=expiring", route);
    expect(
      await screen.findByRole("heading", { level: 1, name: "Expiring soon" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Expiring" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("2 secrets")).toBeInTheDocument();
    expect(names()).toEqual(["portal.example.org", "Status page API"]);
    const row = screen.getByRole("row", { name: /portal\.example\.org/ });
    expect(within(row).getByText("SSL/PKI Certificate")).toBeInTheDocument();
    expect(within(row).getByText("Platform / Certificates")).toBeInTheDocument();
    expect(within(row).getByText("No target")).toBeInTheDocument();
    expect(within(row).getByRole("link")).toHaveAttribute(
      "href",
      "/secret/mock-secret-portal-cert",
    );
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/");
  });

  it("switches status from the segmented control", async () => {
    const user = userEvent.setup();
    renderRoute("/secrets?status=expiring", route);
    await screen.findByRole("heading", { level: 1, name: "Expiring soon" });
    await user.click(screen.getByRole("radio", { name: "Drift" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Drift" })).toBeInTheDocument();
    expect(names()).toEqual(["DB admin", "Edge router admin"]);
    expect(screen.getByRole("row", { name: /Edge router admin/ })).toHaveTextContent("Unreachable");
  });

  it("shows a skeleton while the next status loads", async () => {
    const user = userEvent.setup();
    renderRoute("/secrets?status=all", route);
    await screen.findByRole("heading", { level: 1, name: "Accessible secrets" });
    server.use(api.query("DashboardSecretsByStatus", () => new Promise<never>(() => {})));
    await user.click(screen.getByRole("radio", { name: "Expired" }));
    expect(await screen.findByLabelText("Loading secrets")).toHaveAttribute("aria-busy", "true");
  });

  it("filters by name, type or folder, starting from the header search", async () => {
    const user = userEvent.setup();
    renderRoute("/secrets?q=vpn", route);
    const filter = await screen.findByRole("searchbox", { name: "Filter by name, type or folder" });
    expect(filter).toHaveValue("vpn");
    expect(names()).toEqual(["Acme VPN"]);
    expect(screen.getByText("1 secret")).toBeInTheDocument();
    await user.clear(filter);
    await user.type(filter, "certificate");
    expect(names()).toEqual(["old.example.org", "portal.example.org"]);
    await user.clear(filter);
    await user.type(filter, "zzz");
    expect(screen.getByText('No secrets match "zzz"')).toBeInTheDocument();
  });

  it("sorts by name either way", async () => {
    const user = userEvent.setup();
    renderRoute("/secrets?status=drift", route);
    await screen.findByRole("heading", { level: 1, name: "Drift" });
    expect(names()).toEqual(["DB admin", "Edge router admin"]);
    await user.click(screen.getByRole("button", { name: /Name/ }));
    expect(names()).toEqual(["Edge router admin", "DB admin"]);
  });

  it("says so when nothing has the status", async () => {
    mockState.world.secrets = mockState.world.secrets.filter(
      (s) => s.id !== "mock-secret-old-cert",
    );
    renderRoute("/secrets?status=expired", route);
    expect(await screen.findByText("Nothing expired")).toBeInTheDocument();
    expect(screen.getByText("Nothing you can see is past its expiry date.")).toBeInTheDocument();
  });

  it("offers Retry when the list fails to load, and recovers", async () => {
    server.use(
      api.query("DashboardSecretsByStatus", () =>
        HttpResponse.json({
          errors: [
            { extensions: { code: "UNAVAILABLE" }, message: "rpc error: code = Unavailable" },
          ],
        }),
      ),
    );
    const user = userEvent.setup();
    renderRoute("/secrets?status=drift", route);
    expect(await screen.findByText("Couldn't load these secrets")).toBeInTheDocument();
    server.resetHandlers();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("link", { name: "DB admin" })).toBeInTheDocument();
  });
});
