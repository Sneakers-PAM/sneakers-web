import { render, screen } from "@testing-library/react";

import { ApplianceBanners } from "#shell/layout/ApplianceBanners";

describe("ApplianceBanners", () => {
  it("shows the maintenance banner with its reason while maintenance is on", () => {
    render(<ApplianceBanners maintenance maintenanceReason="Upgrading to v2.0" mcpOff={false} />);
    expect(screen.getByRole("status", { name: "Maintenance mode" })).toHaveTextContent(
      "Upgrading to v2.0",
    );
  });

  it("falls back to a plain sentence when the appliance gave no reason", () => {
    render(<ApplianceBanners maintenance maintenanceReason={null} mcpOff={false} />);
    expect(screen.getByRole("status", { name: "Maintenance mode" })).toHaveTextContent(
      "The appliance is refusing writes until it's off.",
    );
  });

  it("shows no maintenance banner while maintenance is off", () => {
    render(<ApplianceBanners maintenance={false} maintenanceReason={null} mcpOff={false} />);
    expect(screen.queryByRole("status", { name: "Maintenance mode" })).toBeNull();
  });

  it("shows the MCP-off notice when the MCP is off", () => {
    render(<ApplianceBanners maintenance={false} maintenanceReason={null} mcpOff />);
    expect(screen.getByRole("status", { name: "MCP status" })).toHaveTextContent("MCP: off.");
  });

  it("shows no MCP notice when the MCP isn't off", () => {
    render(<ApplianceBanners maintenance={false} maintenanceReason={null} mcpOff={false} />);
    expect(screen.queryByRole("status", { name: "MCP status" })).toBeNull();
  });

  it("shows both banners together when both conditions hold", () => {
    render(<ApplianceBanners maintenance maintenanceReason={null} mcpOff />);
    expect(screen.getByRole("status", { name: "Maintenance mode" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "MCP status" })).toBeInTheDocument();
  });
});
