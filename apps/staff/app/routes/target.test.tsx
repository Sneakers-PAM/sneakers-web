import { TargetsListDocument } from "@sneakers-web/api-client";
import { MOCK_GATEWAY_URL, mockState } from "@sneakers-web/mock-gateway";
import { server, withMockGateway } from "@sneakers-web/mock-gateway/testing";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse } from "msw";
import { graphql } from "msw/graphql";

import type { StubRoute } from "@/test/routeStub";

import * as target from "@/routes/target";
import { renderRoute } from "@/test/routeStub";

withMockGateway();

const BOB = "mock-user-bob";
const gateway = graphql.link(`${MOCK_GATEWAY_URL}/graphql`);

const editor = (path: string, id: string): StubRoute => ({
  action: target.action,
  Component: target.default,
  ErrorBoundary: target.ErrorBoundary,
  id,
  loader: target.loader,
  path,
});

const pages = (): StubRoute[] => [
  { Component: () => <h1>Targets list</h1>, path: "/targets" },
  editor("/targets/new", "routes/target"),
  editor("/targets/:id", "routes/target-edit"),
];

describe("U-11 target editor", () => {
  it("creates a personal target and goes back to the list", async () => {
    const user = userEvent.setup();
    renderRoute("/targets/new", pages(), { user: BOB });
    expect(await screen.findByRole("heading", { name: "New target" })).toBeInTheDocument();
    expect(
      screen.getByText("Ask an admin to change Corp directory, Edge router or Primary database."),
    ).toBeInTheDocument();
    await user.type(screen.getByLabelText(/^Name/), "Home NAS");
    await user.type(screen.getByLabelText(/^Host/), "nas.example.org");
    await user.click(screen.getByRole("radio", { name: "Directory domain" }));
    await user.type(screen.getByLabelText("Domain"), "home.example.org");
    await user.click(screen.getByRole("button", { name: "Create target" }));
    expect(await screen.findByRole("heading", { name: "Targets list" })).toBeInTheDocument();
    expect(mockState.world.targets.at(-1)).toMatchObject({
      domain: "home.example.org",
      hostname: "nas.example.org",
      kind: "active-directory",
      name: "Home NAS",
      ownerUserId: BOB,
    });
  });

  it("says what's missing before saving", async () => {
    const user = userEvent.setup();
    renderRoute("/targets/new", pages(), { user: BOB });
    await user.click(await screen.findByRole("button", { name: "Create target" }));
    expect(screen.getByText("Give the target a name.")).toBeInTheDocument();
    expect(screen.getByText("Give the hostname or address.")).toBeInTheDocument();
  });

  it("shows an out-of-list kind capitalized and keeps it pickable after switching away", async () => {
    const user = userEvent.setup();
    renderRoute("/targets/mock-target-build1", pages());
    expect(await screen.findByRole("heading", { name: "Build host" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Linux" })).toBeChecked();
    await user.click(screen.getByRole("radio", { name: "Windows host" }));
    expect(screen.getByRole("radio", { name: "Linux" })).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Linux" }));
    expect(screen.getByRole("radio", { name: "Linux" })).toBeChecked();
  });

  it("accepts an IPv4 or IPv6 address as well as a hostname, and refuses junk", async () => {
    const user = userEvent.setup();
    renderRoute("/targets/new", pages(), { user: BOB });
    await user.type(await screen.findByLabelText(/^Name/), "Reachable");
    const host = screen.getByLabelText(/^Host/);
    await user.type(host, "not a host!!");
    await user.click(screen.getByRole("button", { name: "Create target" }));
    expect(
      screen.getByText("That doesn't look like a hostname, IPv4 or IPv6 address."),
    ).toBeInTheDocument();
    await user.clear(host);
    await user.type(host, "2001:db8::10");
    expect(
      screen.queryByText("That doesn't look like a hostname, IPv4 or IPv6 address."),
    ).not.toBeInTheDocument();
  });

  it("edits the user's own target", async () => {
    const user = userEvent.setup();
    renderRoute("/targets/mock-target-build1", pages());
    expect(await screen.findByRole("heading", { name: "Build host" })).toBeInTheDocument();
    expect(screen.getByText("Personal target · used by 1 secret")).toBeInTheDocument();
    const name = screen.getByLabelText(/^Name/);
    await user.clear(name);
    await user.type(name, "Build host 1");
    await user.click(screen.getByRole("button", { name: "Save target" }));
    expect(await screen.findByRole("heading", { name: "Targets list" })).toBeInTheDocument();
    expect(mockState.world.targets.find((t) => t.id === "mock-target-build1")?.name).toBe(
      "Build host 1",
    );
  });

  it("shows the gateway's refusal and keeps what was typed", async () => {
    mockState.world.targets.find((t) => t.id === "mock-target-build1")!.ownerUserId = BOB;
    const user = userEvent.setup();
    renderRoute("/targets/mock-target-build1", pages(), { user: BOB });
    await screen.findByRole("heading", { name: "Build host" });
    mockState.world.targets.find((t) => t.id === "mock-target-build1")!.ownerUserId =
      "mock-user-alice";
    const name = screen.getByLabelText(/^Name/);
    await user.clear(name);
    await user.type(name, "Mine");
    await user.click(screen.getByRole("button", { name: "Save target" }));
    expect(await screen.findByText("Couldn't save the target")).toBeInTheDocument();
    expect(screen.getByText("You don't have permission to do that.")).toBeInTheDocument();
    expect(screen.getByLabelText(/^Name/)).toHaveValue("Mine");
  });

  it("won't open a shared target for a plain user", async () => {
    renderRoute("/targets/mock-target-db1", pages(), { user: BOB });
    expect(
      await screen.findByText("Only its owner or a site admin can change this target."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to targets" })).toHaveAttribute(
      "href",
      "/targets",
    );
  });

  it("shows an error with Retry when the editor doesn't load", async () => {
    server.use(
      gateway.query(TargetsListDocument, () =>
        HttpResponse.json({
          errors: [{ extensions: { code: "UNAVAILABLE" }, message: "vault down" }],
        } as never),
      ),
    );
    const user = userEvent.setup();
    renderRoute("/targets/mock-target-build1", pages());
    expect(await screen.findByText("The target didn't load")).toBeInTheDocument();
    server.resetHandlers();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("heading", { name: "Build host" })).toBeInTheDocument();
  });
});
