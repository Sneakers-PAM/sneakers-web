import { mockAppliance } from "@sneakers-web/mock-gateway";
import { sessionCookie, withCookie, withMockGateway } from "@sneakers-web/mock-gateway/testing";
import { ProblemActions } from "@sneakers-web/shell";
import { render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";

import { StaffFrame } from "@/frame/StaffFrame";
import { loader as frameLoader } from "@/routes/frame";

withMockGateway();

/** Mounts the real staff frame, with its real loader run against the mock gateway. */
const openFrame = () => {
  const cookie = sessionCookie("mock-user-alice");
  const Stub = createRoutesStub([
    {
      children: [{ Component: () => <h1>Dashboard</h1>, index: true }],
      Component: () => (
        <ProblemActions>
          <StaffFrame />
        </ProblemActions>
      ),
      id: "routes/frame",
      loader: withCookie(cookie, frameLoader),
    },
  ]);
  return render(<Stub initialEntries={["/"]} />);
};

describe("StaffFrame appliance banners", () => {
  it("shows neither banner on a plain install", async () => {
    openFrame();
    await screen.findByText("Dashboard");
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
