import { TargetsDeleteDocument, TargetsListDocument } from "@sneakers-web/api-client";
import { MOCK_GATEWAY_URL, mockState } from "@sneakers-web/mock-gateway";
import { server, withMockGateway } from "@sneakers-web/mock-gateway/testing";
import { Toaster } from "@sneakers-web/ui";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse } from "msw";
import { graphql } from "msw/graphql";

import type { StubRoute } from "@/test/routeStub";

import { onDesktop } from "@/features/requests/testing";
import * as target from "@/routes/target";
import * as targets from "@/routes/targets";
import { renderRoute } from "@/test/routeStub";

withMockGateway();
onDesktop();

const BOB = "mock-user-bob";
const gateway = graphql.link(`${MOCK_GATEWAY_URL}/graphql`);

const pages = (): StubRoute[] => [
  {
    action: targets.action,
    Component: () => (
      <>
        <targets.default />
        <Toaster />
      </>
    ),
    ErrorBoundary: targets.ErrorBoundary,
    loader: targets.loader,
    path: "/targets",
  },
  {
    action: target.action,
    Component: target.default,
    ErrorBoundary: target.ErrorBoundary,
    loader: target.loader,
    path: "/targets/:id",
  },
];

const bobsTarget = () =>
  mockState.world.targets.push({
    connectionId: "mock-conn-ssh",
    hostname: "192.0.2.20",
    id: "mock-target-bob-nas",
    name: "Bob's NAS",
    ownerUserId: BOB,
    sshHostKeys: [],
  });

describe("U-10 targets", () => {
  it("lists shared targets read-only and the user's own with Edit and Delete", async () => {
    bobsTarget();
    renderRoute("/targets", pages(), { user: BOB });
    expect(await screen.findByRole("heading", { name: "Targets" })).toBeInTheDocument();
    const shared = screen.getByRole("row", { name: /Primary database/ });
    expect(within(shared).getAllByText("Shared")[0]).toBeInTheDocument();
    expect(within(shared).getAllByText("db1.example.org")[0]).toBeInTheDocument();
    expect(within(shared).getByText("PostgreSQL")).toBeInTheDocument();
    expect(within(shared).queryByRole("link", { name: /Edit/ })).toBeNull();
    const mine = screen.getByRole("row", { name: /Bob's NAS/ });
    expect(within(mine).getAllByText("Personal")[0]).toBeInTheDocument();
    expect(within(mine).getByRole("link", { name: "Edit Bob's NAS" })).toHaveAttribute(
      "href",
      "/targets/mock-target-bob-nas",
    );
    expect(screen.getByRole("link", { name: /New target/ })).toHaveAttribute(
      "href",
      "/targets/new",
    );
  });

  it("deletes an unused target after asking", async () => {
    bobsTarget();
    const user = userEvent.setup();
    renderRoute("/targets", pages(), { user: BOB });
    const row = await screen.findByRole("row", { name: /Bob's NAS/ });
    await user.click(within(row).getByRole("button", { name: "Delete Bob's NAS" }));
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete" }),
    );
    expect(await screen.findByText("Deleted Bob's NAS.")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("row", { name: /Bob's NAS/ })).toBeNull());
  });

  it("can't delete a target secrets still use", async () => {
    renderRoute("/targets", pages());
    const row = await screen.findByRole("row", { name: /Primary database/ });
    expect(within(row).getByRole("button", { name: "Delete Primary database" })).toBeDisabled();
  });

  it("says why a delete was refused", async () => {
    bobsTarget();
    server.use(
      gateway.mutation(TargetsDeleteDocument, () =>
        HttpResponse.json({ data: { deleteTarget: false } } as never),
      ),
    );
    const user = userEvent.setup();
    renderRoute("/targets", pages(), { user: BOB });
    const row = await screen.findByRole("row", { name: /Bob's NAS/ });
    await user.click(within(row).getByRole("button", { name: "Delete Bob's NAS" }));
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete" }),
    );
    expect(
      await screen.findByText(
        "Bob's NAS is still in use by a secret. Point the secret elsewhere first.",
      ),
    ).toBeInTheDocument();
  });

  it("shows the empty state when there are no targets", async () => {
    mockState.world.targets = [];
    renderRoute("/targets", pages(), { user: BOB });
    expect(await screen.findByText("No targets yet")).toBeInTheDocument();
  });

  it("shows an error with Retry, and loads once the gateway answers", async () => {
    server.use(
      gateway.query(TargetsListDocument, () =>
        HttpResponse.json({
          errors: [{ extensions: { code: "UNAVAILABLE" }, message: "vault down" }],
        } as never),
      ),
    );
    const user = userEvent.setup();
    renderRoute("/targets", pages(), { user: BOB });
    expect(await screen.findByText("Targets didn't load")).toBeInTheDocument();
    server.resetHandlers();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("row", { name: /Primary database/ })).toBeInTheDocument();
  });
});
