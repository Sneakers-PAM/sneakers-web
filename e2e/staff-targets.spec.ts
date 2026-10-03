import { expect, test } from "@playwright/test";

import { signInAsAlice } from "./signIn";

test("a user adds a personal target, then opens an SSH key's mock terminal", async ({ page }) => {
  await signInAsAlice(page, "/targets");
  await expect(page.getByRole("heading", { name: "Targets" })).toBeVisible();
  await page.getByRole("link", { name: "New target" }).click();
  await expect(page.getByRole("heading", { name: "New target" })).toBeVisible();
  await page.getByLabel(/^Name/).fill("Lab switch");
  await page.getByLabel(/^Hostname/).fill("192.0.2.40");
  await page.getByRole("button", { name: "Create target" }).click();
  await expect(page.getByRole("row", { name: /Lab switch/ })).toBeVisible();

  await page.goto("/secret/mock-secret-build-ssh/terminal");
  await expect(page.getByText("Build host deploy key")).toBeVisible();
  await expect(page.getByText("Connected", { exact: true })).toBeVisible();
  const terminal = page.locator(".xterm-rows");
  await expect(terminal).toContainText("MOCK SESSION");
  await page.locator(".xterm-helper-textarea").pressSequentially("whoami");
  await page.keyboard.press("Enter");
  await expect(terminal).toContainText("deploy@build1:~$ whoami");
  await page.getByRole("link", { name: "Back" }).click();
  await expect(page.getByRole("heading", { name: "Build host deploy key" })).toBeVisible();
});
