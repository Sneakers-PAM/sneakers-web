import { AgentsRevokeTokenDocument, AgentsTokensDocument } from "@sneakers-web/api-client";
import { MOCK_GATEWAY_URL, mockState } from "@sneakers-web/mock-gateway";
import { server, withMockGateway } from "@sneakers-web/mock-gateway/testing";
import { Toaster } from "@sneakers-web/ui";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse } from "msw";
import { graphql } from "msw/graphql";

import type { StubRoute } from "@/test/routeStub";

import { onDesktop } from "@/features/requests/testing";
import * as tokens from "@/routes/tokens";
import { renderRoute } from "@/test/routeStub";

withMockGateway();
onDesktop();

const page = (): StubRoute => ({
  action: tokens.action,
  Component: () => (
    <>
      <tokens.default />
      <Toaster />
    </>
  ),
  ErrorBoundary: tokens.ErrorBoundary,
  loader: tokens.loader,
  path: "/tokens",
});

const gateway = graphql.link(`${MOCK_GATEWAY_URL}/graphql`);

describe("U-13 my tokens", () => {
  it("lists the user's tokens with their state, and how to connect an agent", async () => {
    renderRoute("/tokens", page());
    const active = await screen.findByRole("row", { name: /build1 agent/ });
    expect(within(active).getByText("Build agent")).toBeInTheDocument();
    expect(within(active).getByText("Active")).toBeInTheDocument();
    // The tbody is the second rowgroup, after the table head.
    expect(screen.getAllByRole("rowgroup")[1]).toHaveClass("[&>tr:nth-child(even)]:bg-sunken/50");
    const old = screen.getByRole("row", { name: /old laptop/ });
    expect(within(old).getByText("Expired")).toBeInTheDocument();
    expect(within(old).queryByRole("button", { name: /Revoke/ })).toBeNull();
    expect(screen.queryByText("Bob's workstation")).toBeNull();
    expect(screen.getByRole("heading", { name: "Connect an agent" })).toBeInTheDocument();
  });

  it("revokes a token after confirming", async () => {
    const user = userEvent.setup();
    renderRoute("/tokens", page());
    await user.click(await screen.findByRole("button", { name: "Revoke build1 agent" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Revoke build1 agent?" });
    await user.click(within(dialog).getByRole("button", { name: "Revoke token" }));
    expect(await screen.findByText("build1 agent is revoked.")).toBeInTheDocument();
    const row = await screen.findByRole("row", { name: /build1 agent/ });
    expect(await within(row).findByText("Revoked")).toBeInTheDocument();
    expect(
      mockState.world.tokens.find((t) => t.id === "mock-token-1")?.revokedAtUnix,
    ).toBeGreaterThan(0);
  });

  it("says why a revoke was refused", async () => {
    server.use(
      gateway.mutation(AgentsRevokeTokenDocument, () =>
        HttpResponse.json({
          errors: [
            {
              extensions: { code: "NOT_FOUND" },
              message: "rpc error: code = NotFound desc = token not found",
            },
          ],
        } as never),
      ),
    );
    const user = userEvent.setup();
    renderRoute("/tokens", page());
    await user.click(await screen.findByRole("button", { name: "Revoke build1 agent" }));
    await user.click(await screen.findByRole("button", { name: "Revoke token" }));
    expect(
      await screen.findByText("That item no longer exists. It may have been deleted."),
    ).toBeInTheDocument();
  });

  it("shows the empty state for someone with no tokens", async () => {
    renderRoute("/tokens", page(), { user: "mock-user-carol" });
    expect(await screen.findByText("No personal tokens yet")).toBeInTheDocument();
  });

  it("shows an error with Retry, and loads once the gateway answers", async () => {
    server.use(
      gateway.query(AgentsTokensDocument, () =>
        HttpResponse.json({
          errors: [{ extensions: { code: "UNAVAILABLE" }, message: "identity down" }],
        } as never),
      ),
    );
    const user = userEvent.setup();
    renderRoute("/tokens", page());
    expect(await screen.findByText("Tokens didn't load")).toBeInTheDocument();
    server.resetHandlers();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("row", { name: /build1 agent/ })).toBeInTheDocument();
  });
});
