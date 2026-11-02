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

test("a secret's type changes on its own page, keeping its values", async ({ page }) => {
  await signInAsAlice(page, "/secret/mock-secret-edge-router/edit");
  await page.getByRole("button", { name: "Change type…" }).click();
  await expect(page).toHaveURL(/\/secret\/mock-secret-edge-router\/change-type$/);
  await page.getByRole("combobox", { name: /New type/ }).click();
  await page.getByRole("option", { name: "Password Account (SSH)" }).click();

  const check = page.getByRole("region", { name: "Check" });
  await expect(check).toContainText("Username stays in Username.");
  await expect(page.locator("body")).not.toContainText("mock-Vamp-Collar-63");
  await page.getByRole("textbox", { name: /Host/ }).fill("router.example.org");
  await page.getByRole("button", { name: "Next: review" }).click();

  const review = page.getByRole("region", { name: "Review what moves" });
  await expect(review.getByRole("listitem", { name: "Username" })).toContainText("unchanged");
  await expect(review).toContainText("New field Host: router.example.org");
  await page.getByRole("button", { name: "Change type" }).click();

  await expect(page).toHaveURL(/\/secret\/mock-secret-edge-router\/edit$/);
  const form = page.getByRole("region", { name: "Fields" });
  await expect(form.getByRole("textbox", { name: /Host/ })).toHaveValue("router.example.org");
  await expect(form.getByRole("textbox", { name: /Username/ })).toHaveValue("admin");
});

test("a Secure Note becomes a GitHub App, its note lined up as the private key", async ({
  page,
}) => {
  await signInAsAlice(page, "/secret/mock-secret-alice-wifi/change-type");
  await page.getByRole("combobox", { name: /New type/ }).click();
  await page.getByRole("option", { name: "GitHub App" }).click();

  const check = page.getByRole("region", { name: "Check" });
  const key = page.getByRole("button", { name: /^Private Key \(PEM\), lined up against Note\./ });
  await expect(key).toBeVisible();
  await expect(check).toContainText("Note moves to Private Key (PEM).");
  await expect(check).toContainText("Nothing goes to Notes.");
  await expect(page.locator("body")).not.toContainText("mock-wifi-passphrase");

  // Dragging a non-sensitive field next to the note is refused, with how to fix it.
  await page.getByRole("button", { name: /^Description, not lined up\./ }).dragTo(key);
  await expect(check).toContainText(
    "Note is sensitive and can't go into Description. Move a sensitive field next to it.",
  );
  await expect(page.getByRole("button", { name: "Next: review" })).toBeDisabled();
  await page
    .getByRole("button", { name: /^Private Key \(PEM\), not lined up\./ })
    .dragTo(page.getByRole("button", { name: /^Description, lined up against Note\./ }));
  await expect(check).toContainText("Note moves to Private Key (PEM).");

  await page.getByRole("textbox", { name: /App ID/ }).fill("5530191");
  await page.getByRole("textbox", { name: /Owner Org/ }).fill("example-org");
  await page.getByRole("button", { name: "Next: review" }).click();

  const review = page.getByRole("region", { name: "Review what moves" });
  await expect(review).toContainText("Note moves to Private Key (PEM)");
  await review.getByRole("button", { name: "Reveal Note" }).click();
  await expect(review).toContainText("mock-wifi-passphrase");
  await page.getByRole("button", { name: "Change type" }).click();

  await expect(page).toHaveURL(/\/secret\/mock-secret-alice-wifi$/);
  await expect(page.getByText("Lab wifi is now GitHub App").first()).toBeVisible();
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
