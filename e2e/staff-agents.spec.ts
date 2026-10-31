import { expect, test } from "@playwright/test";

import { signInAsAlice } from "./signIn";

const LOOPBACK = "http://127.0.0.1:53682";

test("an agent signs in, gets a use grant, and a use waits for approval", async ({ page }) => {
  // The MCP client listens on its loopback address for the consent's redirect.
  await page.route(`${LOOPBACK}/**`, (route) =>
    route.fulfill({ body: "<p>Signed in. You can close this tab.</p>", contentType: "text/html" }),
  );
  await signInAsAlice(page, "/");

  // A new mock id per run starts its own sign-in request, so a retry never finds it used up.
  const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const label = `e2e agent ${run}`;
  await page.goto(`/oauth/consent?req=mock-consent-new-${run}`);
  await expect(
    page.getByRole("heading", { name: "Allow MCP client to use Sneakers-PAM as you?" }),
  ).toBeVisible();
  await page.getByLabel("Token name").fill(label);
  await page.getByLabel("6-digit code").fill("123456");
  await page.getByRole("button", { name: "Allow" }).click();
  await page.waitForURL(`${LOOPBACK}/callback?**`);
  expect(new URL(page.url()).searchParams.get("code")).toMatch(/^mock-code-/);

  await page.goto("/tokens");
  await expect(page.getByRole("row", { name: label }).getByText("Active")).toBeVisible();

  await page.getByRole("link", { name: "Use grants" }).click();
  await page.getByRole("button", { name: "New grant" }).click();
  const form = page.getByRole("form", { name: "New grant" });
  await form.getByRole("button", { name: label }).click();
  await form.getByRole("combobox", { name: "Secrets" }).fill("DB adm");
  await form.getByRole("option", { name: /DB admin/ }).click();
  await form.getByRole("textbox", { name: "Program 1" }).fill("psql");
  await form.getByRole("button", { name: "Create grant…" }).click();
  await page
    .getByRole("alertdialog", { name: "Create this grant?" })
    .getByRole("button", { name: "Continue" })
    .click();
  const confirm = page.getByRole("dialog", { name: "Confirm it's you" });
  await confirm.getByLabel("6-digit code").fill("123456");
  await confirm.getByRole("button", { name: "Create grant" }).click();
  await expect(
    page.getByText("Grant created. It runs without asking until it ends.").first(),
  ).toBeVisible();
  await expect(page.getByRole("row", { name: label })).toBeVisible();

  await page
    .getByRole("link", { name: /Approvals/ })
    .first()
    .click();
  await expect(page.getByRole("heading", { name: "Approvals" })).toBeVisible();
  // Nobody approves their own request: Alice's agent's use of DB admin waits for an owner or
  // approver, and the dashboard's flow still needs it waiting.
  await expect(page.getByText("Nothing waiting")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Your requests" }).getByRole("row", { name: /DB admin/ }),
  ).toContainText("Waiting for an owner or approver");
});

test("a revoked token can be deleted, and leaves the list", async ({ page }) => {
  await page.route(`${LOOPBACK}/**`, (route) =>
    route.fulfill({ body: "<p>Signed in. You can close this tab.</p>", contentType: "text/html" }),
  );
  await signInAsAlice(page, "/");

  const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const label = `e2e delete ${run}`;
  await page.goto(`/oauth/consent?req=mock-consent-new-${run}`);
  await page.getByLabel("Token name").fill(label);
  await page.getByLabel("6-digit code").fill("123456");
  await page.getByRole("button", { name: "Allow" }).click();
  await page.waitForURL(`${LOOPBACK}/callback?**`);

  await page.goto("/tokens");
  const row = page.getByRole("row", { name: label });
  await expect(row.getByRole("button", { name: `Delete ${label}` })).toHaveCount(0);

  await row.getByRole("button", { name: `Revoke ${label}` }).click();
  await page.getByRole("button", { name: "Revoke token" }).click();
  await expect(row.getByText("Revoked")).toBeVisible();

  await row.getByRole("button", { name: `Delete ${label}` }).click();
  await page.getByRole("button", { name: "Delete token" }).click();
  await expect(page.getByText("Token deleted.").first()).toBeVisible();
  await expect(row).toHaveCount(0);
});
