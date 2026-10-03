import { withMockGateway } from "@sneakers-web/mock-gateway/testing";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import * as accounts from "@/routes/service-accounts";
import * as account from "@/routes/service-accounts.$id";
import * as newAccount from "@/routes/service-accounts.new";
import { renderAdmin } from "@/test/stub";

withMockGateway();

const ROUTES = [
  { module: accounts, path: "/service-accounts" },
  { module: newAccount, path: "/service-accounts/new" },
  { module: account, path: "/service-accounts/:id" },
];

describe("service accounts", () => {
  it("lists accounts with who made them and how they sign in", async () => {
    renderAdmin(ROUTES, "/service-accounts");
    const ci = await screen.findByRole("row", { name: /CI Pipeline/ });
    expect(within(ci).getByText("API tokens + OIDC")).toBeInTheDocument();
    expect(within(ci).getByText(/by Carol/)).toBeInTheDocument();
    expect(
      within(screen.getByRole("row", { name: /Legacy deploy script/ })).getByText("Disabled"),
    ).toBeInTheDocument();
  });

  it("creates an account and opens it", async () => {
    const user = userEvent.setup();
    renderAdmin(ROUTES, "/service-accounts/new");
    await user.type(await screen.findByLabelText(/Name/), "Report runner");
    await user.click(screen.getByRole("button", { name: "Create service account" }));
    expect(await screen.findByRole("heading", { name: "Report runner" })).toBeInTheDocument();
    expect(screen.getByText(/No tokens yet/)).toBeInTheDocument();
  });

  it("mints a token scoped to groups and shows it once", async () => {
    const user = userEvent.setup();
    renderAdmin(ROUTES, "/service-accounts/mock-sa-backup");
    await user.click(await screen.findByRole("button", { name: "Mint token…" }));
    expect(screen.getByRole("button", { name: "Mint token" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Add group" }));
    await user.click(await screen.findByRole("menuitem", { name: "Finance" }));
    await user.click(screen.getByRole("button", { name: "Mint token" }));
    expect(await screen.findByRole("heading", { name: "Token minted" })).toBeInTheDocument();
    expect(screen.getByLabelText("New API token").textContent).toMatch(/^mock-sa-token-/);
    await user.click(screen.getByRole("button", { name: "Done, I've stored it" }));
    expect(screen.queryByLabelText("New API token")).not.toBeInTheDocument();
    expect(await screen.findByRole("row", { name: /^Finance/ })).toBeInTheDocument();
  });

  it("revokes a token", async () => {
    const user = userEvent.setup();
    renderAdmin(ROUTES, "/service-accounts/mock-sa-backup");
    await user.click(await screen.findByRole("button", { name: "Revoke the DB team token" }));
    expect(await screen.findByText("Revoked")).toBeInTheDocument();
  });

  it("links and unlinks an OIDC client", async () => {
    const user = userEvent.setup();
    renderAdmin(ROUTES, "/service-accounts/mock-sa-backup");
    await user.type(await screen.findByLabelText("Client ID"), "backup-job");
    await user.click(screen.getByRole("button", { name: "Link client" }));
    expect(await screen.findByDisplayValue("https://auth.example.org/")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Unlink" }));
    expect(await screen.findByRole("button", { name: "Link client" })).toBeInTheDocument();
  });

  it("disables an account after a confirmation", async () => {
    const user = userEvent.setup();
    renderAdmin(ROUTES, "/service-accounts/mock-sa-ci");
    await user.click(await screen.findByRole("button", { name: "Disable…" }));
    await user.click(screen.getByRole("button", { name: "Disable" }));
    expect(await screen.findByText(/This service account is disabled/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mint token…" })).not.toBeInTheDocument();
  });
});
