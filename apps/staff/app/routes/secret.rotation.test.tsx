import { mockState } from "@sneakers-web/mock-gateway";
import { withMockGateway } from "@sneakers-web/mock-gateway/testing";
import { screen, within } from "@testing-library/react";

import * as secret from "@/routes/secret";
import { renderRoute } from "@/test/routeStub";

withMockGateway();

const DB = "mock-secret-db-admin";

const routes = [
  {
    action: secret.action,
    Component: secret.default,
    ErrorBoundary: secret.ErrorBoundary,
    loader: secret.loader,
    path: "/secret/:id",
  },
];

const database = () => mockState.world.secrets.find((s) => s.id === DB)!;
const target = (id: string) => mockState.world.targets.find((t) => t.id === id)!;

const open = async (id = DB) => {
  renderRoute(`/secret/${id}`, routes);
  await screen.findByRole("heading", { level: 1 });
  return {
    automation: screen.queryByRole("region", { name: "Automation" })!,
    details: screen.getByRole("region", { name: "Details" }),
  };
};

describe("whether a secret rotates", () => {
  it("says a secret with no target isn't rotating, with no next rotation", async () => {
    Object.assign(database(), {
      nextRotationAt: new Date(Date.now() + 86_400_000).toISOString(),
      targetId: undefined,
    });
    const { automation, details } = await open();
    expect(within(details).getByText("Not rotating")).toBeInTheDocument();
    expect(within(details).getByText("It has no target to rotate on.")).toBeInTheDocument();
    expect(within(details).queryByText(/Next rotation/)).toBeNull();
    expect(
      within(automation).getByText("Not rotating: it needs a target with a connection."),
    ).toBeInTheDocument();
  });

  it("says a secret whose target has no connection isn't rotating", async () => {
    target("mock-target-db1").connectionId = "";
    const { automation, details } = await open();
    expect(within(details).getByText("Not rotating")).toBeInTheDocument();
    expect(
      within(details).getByText("Its target, Primary database, has no connection."),
    ).toBeInTheDocument();
    expect(
      within(automation).getByText("Not rotating: it needs a target with a connection."),
    ).toBeInTheDocument();
  });

  it("says a secret with rotation turned off isn't rotating", async () => {
    Object.assign(database(), {
      nextRotationAt: new Date(Date.now() + 86_400_000).toISOString(),
      rotationOptOut: true,
    });
    const { details } = await open();
    expect(within(details).getByText("Not rotating")).toBeInTheDocument();
    expect(
      within(details).getByText("Rotation is turned off for this secret."),
    ).toBeInTheDocument();
    expect(within(details).queryByText(/Next rotation/)).toBeNull();
  });

  it("shows the last result and the next rotation for a secret that rotates", async () => {
    database().nextRotationAt = new Date(Date.now() + 3 * 86_400_000).toISOString();
    const { automation, details } = await open();
    expect(within(details).queryByText("Not rotating")).toBeNull();
    expect(within(details).getByText(/Next rotation in 3 days/)).toBeInTheDocument();
    expect(within(automation).getByText(/^Every 30 days/)).toBeInTheDocument();
  });

  it("says nothing about rotation for a type that can't rotate", async () => {
    const { details } = await open("mock-secret-status-api");
    expect(within(details).queryByText("Rotation")).toBeNull();
    expect(within(details).queryByText("Not rotating")).toBeNull();
  });
});
