import { AgentsGrantsDocument } from "@sneakers-web/api-client";
import { MOCK_GATEWAY_URL, mockState } from "@sneakers-web/mock-gateway";
import { server, withMockGateway } from "@sneakers-web/mock-gateway/testing";
import { Toaster } from "@sneakers-web/ui";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse } from "msw";
import { graphql } from "msw/graphql";

import type { StubRoute } from "@/test/routeStub";

import { onDesktop } from "@/features/requests/testing";
import * as grants from "@/routes/grants";
import { renderRoute } from "@/test/routeStub";

withMockGateway();
onDesktop();

const page = (): StubRoute => ({
  action: grants.action,
  Component: () => (
    <>
      <grants.default />
      <Toaster />
    </>
  ),
  ErrorBoundary: grants.ErrorBoundary,
  loader: grants.loader,
  path: "/grants",
});

const gateway = graphql.link(`${MOCK_GATEWAY_URL}/graphql`);

describe("U-15 use grants", () => {
  it("lists the user's grants by token and secret name", async () => {
    renderRoute("/grants", page());
    const row = await screen.findByRole("row", { name: /build1 agent/ });
    expect(within(row).getByText("DB admin")).toBeInTheDocument();
    expect(within(row).getByText("psql -h db1.example.org")).toBeInTheDocument();
    expect(within(row).getByText("3 / 20")).toBeInTheDocument();
    expect(within(row).getByText("Active")).toBeInTheDocument();
  });

  it("creates a grant through confirm and a second factor", async () => {
    const user = userEvent.setup();
    renderRoute("/grants", page());
    await user.click(await screen.findByRole("button", { name: "New grant" }));
    const form = screen.getByRole("form", { name: "New grant" });
    await user.type(within(form).getByRole("combobox", { name: "Secrets" }), "DB adm");
    await user.click(await within(form).findByRole("option", { name: /DB admin/ }));
    expect(within(form).getByRole("button", { name: "Remove DB admin" })).toBeInTheDocument();
    await user.type(within(form).getByRole("textbox", { name: "Program 1" }), "psql");
    await user.click(within(form).getByRole("button", { name: "Create grant…" }));
    const confirm = await screen.findByRole("alertdialog", { name: "Create this grant?" });
    expect(within(confirm).getByText("DB admin")).toBeInTheDocument();
    await user.click(within(confirm).getByRole("button", { name: "Continue" }));
    const dialog = await screen.findByRole("dialog", { name: "Confirm it's you" });
    await user.type(within(dialog).getByLabelText("6-digit code"), "123456");
    await user.click(within(dialog).getByRole("button", { name: "Create grant" }));
    expect(
      await screen.findByText("Grant created. It runs without asking until it ends."),
    ).toBeInTheDocument();
    expect(mockState.world.useGrants).toHaveLength(2);
    expect(mockState.world.useGrants[1]).toMatchObject({
      programs: [{ args: ["*"], path: "psql" }],
      secretIds: ["mock-secret-db-admin"],
      tokenId: "mock-token-1",
    });
  });

  it("asks for a secret and a program before confirming", async () => {
    const user = userEvent.setup();
    renderRoute("/grants", page());
    await user.click(await screen.findByRole("button", { name: "New grant" }));
    await user.click(screen.getByRole("button", { name: "Create grant…" }));
    expect(screen.getByText("Pick at least one secret.")).toBeInTheDocument();
    expect(screen.getByText("Add at least one program, or allow reveal.")).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("revokes a grant after confirming", async () => {
    const user = userEvent.setup();
    renderRoute("/grants", page());
    await user.click(await screen.findByRole("button", { name: "Revoke grant for build1 agent" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Revoke this grant?" });
    await user.click(within(dialog).getByRole("button", { name: "Revoke grant" }));
    expect(await screen.findByText("Grant revoked.")).toBeInTheDocument();
    expect(mockState.world.useGrants[0]?.revokedAtUnix).toBeGreaterThan(0);
  });

  it("shows the empty state, and says a token is needed first", async () => {
    renderRoute("/grants", page(), { user: "mock-user-carol" });
    expect(await screen.findByText("No use grants")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New grant" })).toBeDisabled();
    expect(screen.getByText(/You need an active personal token/)).toBeInTheDocument();
  });

  it("shows an error with Retry, and loads once the gateway answers", async () => {
    server.use(
      gateway.query(AgentsGrantsDocument, () =>
        HttpResponse.json({
          errors: [{ extensions: { code: "UNAVAILABLE" }, message: "vault down" }],
        } as never),
      ),
    );
    const user = userEvent.setup();
    renderRoute("/grants", page());
    expect(await screen.findByText("Use grants didn't load")).toBeInTheDocument();
    server.resetHandlers();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("row", { name: /build1 agent/ })).toBeInTheDocument();
  });
});
