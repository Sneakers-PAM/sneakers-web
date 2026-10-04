import { expect, test } from "@playwright/test";

import { signInAsAlice, signOut, switchToDark } from "./signIn";

test("the admin console signs in under /admin/, keeps the theme and signs out", async ({
  page,
}) => {
  await signInAsAlice(page, "/admin/users");
  await expect(page).toHaveURL(/\/admin\/users$/);
  await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
  await expect(page.getByRole("link", { name: "User app" })).toBeVisible();

  await switchToDark(page);
  await signOut(page);
  await expect(page).toHaveURL(/\/admin\/sign-in$/);
});

test("single sign-on hands back to the second-factor step", async ({ page }) => {
  await page.goto("/admin/sign-in");
  await page.getByRole("button", { name: "Sign in with SSO" }).click();
  await expect(page).toHaveURL(/\/admin\/sign-in\?sso_pending=/);
  await expect(page.getByRole("heading", { name: "Enter your code" })).toBeVisible();
});

test("a site admin grants the recovery role and files a new hire into a group", async ({
  page,
}) => {
  await signInAsAlice(page, "/admin/users");
  await page.getByRole("link", { name: "Bob" }).click();
  await expect(page.getByRole("heading", { name: "Bob" })).toBeVisible();
  const recovery = page.getByRole("switch", { name: "Recovery" });
  await recovery.click();
  await page.getByRole("button", { name: "Grant" }).click();
  await expect(recovery).toBeChecked();
  await page.reload();
  await expect(page.getByRole("switch", { name: "Recovery" })).toBeChecked();

  await page.goto("/admin/users/new");
  await page.getByLabel(/Display name/).fill("Frank");
  await page.getByLabel(/Username/).fill("frank");
  await page.getByLabel(/Email/).fill("frank@example.org");
  await page.getByRole("button", { name: "Create user" }).click();
  await expect(page.getByRole("heading", { name: "Verify email" })).toBeVisible();
  await page.getByLabel("6-digit code").fill("481027");
  await expect(page.getByRole("heading", { name: "Email verified" })).toBeVisible();

  await page.goto("/admin/groups/mock-group-finance");
  await page.getByLabel("Add member…").fill("frank");
  await page.getByRole("button", { name: "Add Frank" }).click();
  await expect(page.getByText("Group · 2 members")).toBeVisible();
});

test("a site admin turns on MFA before a reveal and builds a custom type", async ({ page }) => {
  await signInAsAlice(page, "/admin/policies");
  const reveal = page.getByRole("switch", { name: "Require MFA before a reveal" });
  await expect(reveal).not.toBeChecked();
  await reveal.click();
  await expect(reveal).toBeChecked();
  await page.reload();
  await expect(page.getByRole("switch", { name: "Require MFA before a reveal" })).toBeChecked();

  await page.goto("/admin/types/new");
  await page.getByLabel(/Type name/).fill("Alarm Panel");
  await page.getByRole("button", { name: "Add field" }).click();
  await page.getByLabel("Field 1 label").fill("Code");
  await page.getByRole("button", { name: "Save type" }).click();
  await expect(page.getByRole("link", { exact: true, name: "Alarm Panel" })).toBeVisible();
});

test("a site admin adds a connection and a pinned SSH target on it", async ({ page }) => {
  await signInAsAlice(page, "/admin/connections");
  await page.getByRole("button", { name: "Add connection" }).click();
  const card = page.getByRole("form", { name: "New connection" });
  await card.getByLabel("Name").fill("Bastion SSH");
  await card.getByRole("button", { name: "Save the new connection" }).click();
  await expect(page.getByRole("form", { name: "Connection Bastion SSH" })).toBeVisible();

  await page.goto("/admin/targets/new");
  await page.getByLabel(/^Name/).fill("Bastion");
  await page.getByLabel(/^Hostname/).fill("bastion.example.org");
  await page.getByRole("combobox", { name: /Connection/ }).click();
  await page.getByRole("option", { name: "Bastion SSH (ssh:22)" }).click();
  await page.getByLabel("Pinned keys").fill("ssh-ed25519 AAAAC3Nza bastion");
  await page.getByRole("button", { name: "Create target" }).click();
  await expect(page.getByRole("row", { name: /Bastion/ })).toContainText("1 pin");
});

test("a site admin makes a service account and mints its first token", async ({ page }) => {
  await signInAsAlice(page, "/admin/service-accounts/new");
  await page.getByLabel(/Name/).fill("Report runner");
  await page.getByRole("button", { name: "Create service account" }).click();
  await expect(page.getByRole("heading", { name: "Report runner" })).toBeVisible();
  await page.getByRole("button", { name: "Mint token…" }).click();
  await page.getByRole("button", { name: "Add group" }).click();
  await page.getByRole("menuitem", { name: "DB team" }).click();
  await page.getByRole("button", { name: "Mint token" }).click();
  await expect(page.getByLabel("New API token")).toContainText("mock-sa-token-");
  await page.getByRole("button", { name: "Done, I've stored it" }).click();
  await expect(page.getByRole("row", { name: /^DB team/ })).toBeVisible();
});

test("a site admin filters the audit trail, opens a record and exports it", async ({ page }) => {
  await signInAsAlice(page, "/admin/audit");
  await expect(page.getByText(/Chain verified/)).toBeVisible();
  await page.getByLabel("Actor").fill("Bob");
  await page.getByLabel("Actor").press("Enter");
  await expect(page).toHaveURL(/actor=Bob/);
  await page.getByRole("link", { name: "Open record 1197" }).click();
  await expect(page.getByRole("dialog")).toContainText("web-01 deploy key");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Export" }).click();
  const downloading = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: "CSV (spreadsheets)" }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/^sneakers-audit-.*\.csv$/);
});

test("a site admin makes a shared folder and requires MFA before a reveal in it", async ({
  page,
}) => {
  await signInAsAlice(page, "/admin/folders");
  await page.getByRole("button", { name: "New shared folder" }).click();
  await page.getByLabel(/Name/).fill("Security");
  await page.getByRole("button", { name: "Create folder" }).click();
  await expect(page.getByRole("heading", { name: "Security" })).toBeVisible();
  await page.getByRole("radio", { name: "Require" }).click();
  await expect(page.getByText(/A fresh second factor is required/)).toBeVisible();
  await page.reload();
  await expect(page.getByRole("radio", { name: "Require" })).toHaveAttribute("data-state", "on");
});
