import { expect, test } from "@playwright/test";

import { signInAsAlice } from "./signIn";

const LOOPBACK = "http://127.0.0.1:53682";

test("an agent signs in, gets a use grant, and a use waits for approval", async ({ page }) => {
  // The MCP client listens on its loopback address for the consent's redirect.
  await page.route(`${LOOPBACK}/**`, (route) =>
    route.fulfill({ body: "<p>Signed in. You can close this tab.</p>", contentType: "text/html" }),
  );
  await signInAsAlice(page, "/");

  await page.goto("/oauth/consent?req=mock-consent-1");
  await expect(
    page.getByRole("heading", { name: "Allow MCP client to use Sneakers-PAM as you?" }),
  ).toBeVisible();
  await page.getByLabel("Token name").fill("e2e laptop agent");
  await page.getByLabel("6-digit code").fill("123456");
  await page.getByRole("button", { name: "Allow" }).click();
  await page.waitForURL(`${LOOPBACK}/callback?**`);
  expect(new URL(page.url()).searchParams.get("code")).toMatch(/^mock-code-/);

  await page.goto("/tokens");
  await expect(
    page.getByRole("row", { name: /e2e laptop agent/ }).getByText("Active"),
  ).toBeVisible();

  await page.getByRole("link", { name: "Use grants" }).click();
  await page.getByRole("button", { name: "New grant" }).click();
  const form = page.getByRole("form", { name: "New grant" });
  await form.getByRole("button", { name: /e2e laptop agent/ }).click();
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
  await expect(page.getByRole("row", { name: /e2e laptop agent/ })).toBeVisible();

  await page
    .getByRole("link", { name: /Approvals/ })
    .first()
    .click();
  await expect(page.getByRole("heading", { name: "Approvals" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Agent approvals" })).toContainText("1");
  await page.getByRole("button", { name: "Approve use of DB admin" }).click();
  const dialog = page.getByRole("dialog", { name: "Approve use of DB admin?" });
  await dialog.getByLabel("6-digit code").fill("000000");
  await dialog.getByRole("button", { name: "Approve use" }).click();
  await expect(dialog.getByText(/Nothing was approved/)).toBeVisible();
  // The dashboard's flow still needs this use waiting, so this one stops before approving it.
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("row", { name: /DB admin/ })).toBeVisible();
});
