import { expect, test } from "@playwright/test";

import { signInAsAlice } from "./signIn";

test("the dashboard drills from a stat tile into its secrets and on to a secret", async ({
  page,
}) => {
  await signInAsAlice(page, "/");
  await expect(page.getByRole("heading", { level: 1, name: /, Alice$/ })).toBeVisible();
  await expect(page.getByRole("region", { name: "Agent is waiting" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Acme VPN is checked out" })).toBeVisible();
  const top = page.getByRole("region", { name: "Top accessed secrets" });
  await expect(top.getByRole("link")).toHaveCount(5);

  await page.getByRole("link", { name: /^Expiring soon 2 within 30 days/ }).click();
  await expect(page).toHaveURL(/\/secrets\?status=expiring$/);
  await expect(page.getByRole("heading", { level: 1, name: "Expiring soon" })).toBeVisible();
  await expect(page.getByText("2 secrets")).toBeVisible();

  await page.getByRole("radio", { name: "Drift" }).click();
  await expect(page).toHaveURL(/\/secrets\?status=drift$/);
  await expect(page.getByRole("heading", { level: 1, name: "Drift" })).toBeVisible();
  await page.getByLabel("Filter by name, type or folder").fill("edge");
  await expect(page.getByText("1 secret", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Edge router admin" }).click();
  await expect(page).toHaveURL(/\/secret\/mock-secret-edge-router$/);
});

test("the header search opens the secrets list filtered by the query", async ({ page }) => {
  await signInAsAlice(page, "/");
  await page.getByLabel("Search secrets and folders").fill("vpn");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/secrets\?q=vpn$/);
  await expect(page.getByRole("heading", { level: 1, name: "Accessible secrets" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Acme VPN" })).toBeVisible();
  await expect(page.getByText("1 secret", { exact: true })).toBeVisible();
});
