import { expect, test } from "@playwright/test";

import { signInAs, signInAsAlice } from "./signIn";

test("a user adds a personal target, then opens an SSH key's mock terminal", async ({ page }) => {
  await signInAsAlice(page, "/targets");
  await expect(page.getByRole("heading", { name: "Targets" })).toBeVisible();
  await page.getByRole("link", { name: "New target" }).click();
  await expect(page.getByRole("heading", { name: "New target" })).toBeVisible();
  await page.getByLabel(/^Name/).fill("Lab switch");
  await page.getByLabel(/^Host/).fill("192.0.2.40");
  await page.getByRole("button", { name: "Create target" }).click();
  await expect(page.getByRole("row", { name: /Lab switch 192\.0\.2\.40/ })).toBeVisible();

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

// #318: a staff user who isn't a site admin pins their own target's host key on its page.
test("a user scans and pins the host key of a target they made", async ({ page }) => {
  await signInAs(page, "mock-user-bob", "/targets/new");
  await expect(page.getByRole("heading", { name: "New target" })).toBeVisible();
  await page.getByLabel(/^Name/).fill("Bob's NAS");
  await page.getByLabel(/^Host/).fill("192.0.2.41");
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: /^SSH/ }).click();
  await page.getByRole("button", { name: "Create target" }).click();
  await page
    .getByRole("row", { name: /Bob's NAS 192\.0\.2\.41/ })
    .getByRole("link")
    .first()
    .click();
  const card = page.getByRole("region", { name: "SSH host key" });
  await expect(card.getByText(/No host key is pinned yet/)).toBeVisible();
  await card.getByRole("button", { name: "Scan and pin host key…" }).click();
  const dialog = page.getByRole("dialog", { name: "Pin the host key" });
  await expect(dialog.getByText("192.0.2.41:22")).toBeVisible();
  await expect(dialog.getByText(/got another way/)).toBeVisible();
  await dialog.getByRole("button", { name: "Pin this key" }).click();
  await expect(dialog).toBeHidden();
  await expect(card.getByText(/^SHA256:/)).toBeVisible();
  await expect(card.getByText(/No host key is pinned yet/)).toBeHidden();
});
