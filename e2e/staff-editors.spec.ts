import { expect, test } from "@playwright/test";

import { signInAsAlice } from "./signIn";

test("a secret is created from its type's fields, then edited without touching its password", async ({
  page,
}) => {
  await signInAsAlice(page, "/secret/new?folder=mock-folder-databases");
  await expect(page.getByRole("heading", { level: 1, name: "New secret" })).toBeVisible();
  await expect(page.getByText("Secret · Platform / Databases")).toBeVisible();

  await page.getByRole("textbox", { name: /Name/ }).fill("Reporting writer");
  await page.getByRole("combobox", { name: /Type/ }).click();
  await expect(page.getByRole("group", { name: "Extensions" })).toContainText("Acme Router Admin");
  await page.getByRole("option", { name: "Database Account" }).click();

  const fields = page.getByRole("region", { name: "Fields" });
  await page.getByRole("button", { name: "Create secret" }).click();
  await expect(page.getByText(/fields? needs? attention/)).toBeVisible();
  await expect(fields.getByText("Enter the server.")).toBeVisible();

  await fields.getByRole("textbox", { name: /Server/ }).fill("db1.example.org");
  await fields.getByRole("textbox", { name: /Username/ }).fill("report_writer");
  await expect(fields.getByLabel(/^Password/)).not.toHaveValue("");
  await page.getByRole("button", { name: "Create secret" }).click();

  await expect(page.getByRole("heading", { level: 1, name: /Reporting writer/ })).toBeVisible();
  await expect(page).toHaveURL(/\/secret\/mock-secret-/);
  const detail = page.url();

  await page.goto(`${detail}/edit`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Edit Reporting writer" }),
  ).toBeVisible();
  const edit = page.getByRole("region", { name: "Fields" });
  await expect(edit.getByLabel(/^Password/)).toHaveValue("");
  await edit.getByRole("textbox", { name: /Username/ }).fill("report_owner");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page).toHaveURL(detail);
  await expect(page.getByRole("group", { name: "Username" })).toContainText("report_owner");
});

test("an SSH key pair is generated in the vault and only its public half is shown", async ({
  page,
}) => {
  await signInAsAlice(page, "/secret/new?folder=mock-folder-platform");
  await page.getByRole("combobox", { name: /Type/ }).click();
  await page.getByRole("option", { name: "SSH Key" }).click();
  const keys = page.getByRole("region", { name: "Key pair" });
  await keys.getByRole("button", { name: "Generate key pair" }).click();
  await expect(keys.getByRole("textbox", { name: "Public key" })).toHaveValue(/^ssh-ed25519 /);
  await expect(keys).toContainText("Private key generated");
  await expect(page.locator("body")).not.toContainText("BEGIN OPENSSH PRIVATE KEY");
});
