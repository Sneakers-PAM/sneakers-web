import { MOCK_GATEWAY_URL, mockState } from "@sneakers-pam/mock-server/in-process";
import { server, withMockGateway } from "@sneakers-pam/mock-server/in-process/testing";
import {
  AgentsDeleteTokenDocument,
  AgentsRevokeTokenDocument,
  AgentsTokensDocument,
} from "@sneakers-web/api-client";
import { toast, Toaster } from "@sneakers-web/ui";
import { act, screen, waitFor, within } from "@testing-library/react";
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

const revokedToken = (id: string) => {
  const token = mockState.world.tokens.find((t) => t.id === id);
  if (token) token.revokedAtUnix = 1;
};

describe("U-13 my tokens", () => {
  afterEach(() => vi.unstubAllEnvs());
  afterEach(() => act(() => void toast.dismiss()));

  it("shows the administrator fallback with no MCP_URL set", async () => {
    vi.stubEnv("MCP_URL", "");
    renderRoute("/tokens", page());
    expect(await screen.findByRole("heading", { name: "Connect an agent" })).toBeInTheDocument();
    expect(
      screen.getByText("Your administrator has the Sneakers-PAM MCP server address."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Claude's CLI" })).not.toBeInTheDocument();
  });

  it("fills the server URL into each client's setup, with a copy button, and links the approvals matrix", async () => {
    vi.stubEnv("MCP_URL", "https://mcp.sneakers.example.org");
    const user = userEvent.setup();
    renderRoute("/tokens", page());
    expect(
      await screen.findByRole("tab", { name: "Claude's CLI", selected: true }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("claude mcp add --transport http sneakers https://mcp.sneakers.example.org"),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "VS Code" }));
    expect(screen.getByText(/"url": "https:\/\/mcp\.sneakers\.example\.org"/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Copy the VS Code setup/ }));
    expect(await navigator.clipboard.readText()).toContain("https://mcp.sneakers.example.org");
    expect(screen.getByRole("link", { name: /approvals matrix/ })).toHaveAttribute(
      "href",
      "#how-approvals-work",
    );
  });

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

  it("offers Delete only on a revoked token", async () => {
    revokedToken("mock-token-1");
    renderRoute("/tokens", page());
    const revoked = await screen.findByRole("row", { name: /build1 agent/ });
    expect(
      within(revoked).getByRole("button", { name: "Delete build1 agent" }),
    ).toBeInTheDocument();
    expect(within(revoked).queryByRole("button", { name: /Revoke/ })).toBeNull();
    const expired = screen.getByRole("row", { name: /old laptop/ });
    expect(within(expired).queryByRole("button", { name: /Delete/ })).toBeNull();
  });

  it("has no Delete on an active token", async () => {
    renderRoute("/tokens", page());
    const active = await screen.findByRole("row", { name: /build1 agent/ });
    expect(within(active).queryByRole("button", { name: /Delete/ })).toBeNull();
  });

  it("deletes a revoked token after confirming, and removes its row", async () => {
    revokedToken("mock-token-1");
    const user = userEvent.setup();
    renderRoute("/tokens", page());
    await user.click(await screen.findByRole("button", { name: "Delete build1 agent" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Delete build1 agent?" });
    await user.click(within(dialog).getByRole("button", { name: "Delete token" }));
    expect(await screen.findByText("Token deleted.")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("row", { name: /build1 agent/ })).toBeNull());
    expect(screen.getByRole("row", { name: /old laptop/ })).toBeInTheDocument();
    expect(mockState.world.tokens.some((t) => t.id === "mock-token-1")).toBe(false);
  });

  it("still says so when the last token goes and the table with it", async () => {
    mockState.world.tokens = mockState.world.tokens.filter((t) => t.id !== "mock-token-2");
    revokedToken("mock-token-1");
    const user = userEvent.setup();
    renderRoute("/tokens", page());
    await user.click(await screen.findByRole("button", { name: "Delete build1 agent" }));
    await user.click(await screen.findByRole("button", { name: "Delete token" }));
    expect(await screen.findByText("No personal tokens yet")).toBeInTheDocument();
    expect(await screen.findByText("Token deleted.")).toBeInTheDocument();
  });

  it("says why a delete was refused, and keeps the row", async () => {
    revokedToken("mock-token-1");
    server.use(
      gateway.mutation(AgentsDeleteTokenDocument, () =>
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
    await user.click(await screen.findByRole("button", { name: "Delete build1 agent" }));
    await user.click(await screen.findByRole("button", { name: "Delete token" }));
    expect(
      await screen.findByText("That item no longer exists. It may have been deleted."),
    ).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /build1 agent/ })).toBeInTheDocument();
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
