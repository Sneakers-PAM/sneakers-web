import { expect, test } from "@playwright/test";

import { signInAsAlice } from "./signIn";

test("a secret's value is revealed, spelled out and hidden, and break glass shows every field", async ({
  page,
}) => {
  await signInAsAlice(page, "/secret/mock-secret-db-admin");
  await expect(page.getByRole("heading", { level: 1, name: /DB admin/ })).toBeVisible();
  const password = page.getByRole("group", { name: "Password" });
  await expect(password).not.toContainText("mock-Tongue-Eyelet-91");

  await password.getByRole("button", { name: "Reveal Password" }).click();
  await expect(password.getByText("mock-Tongue-Eyelet-91")).toBeVisible();
  await password.getByRole("button", { name: "Phonetic" }).click();
  await expect(password.getByRole("list", { name: "Password, spelled out" })).toContainText(
    "tango (cap)",
  );
  await password.getByRole("button", { name: "Hide" }).click();
  await expect(password).not.toContainText("mock-Tongue-Eyelet-91");

  await page.getByRole("button", { name: "Actions" }).click();
  await page.getByRole("menuitem", { name: /Break glass/ }).click();
  const dialog = page.getByRole("dialog", { name: "Break glass on DB admin?" });
  await dialog.getByLabel(/Reason/).fill("The primary is down and the on-call needs in.");
  await dialog.getByLabel("6-digit code").fill("123456");
  await dialog.getByRole("button", { name: "Break glass" }).click();
  const reveal = page.getByRole("region", { name: "Break-glass reveal" });
  await expect(reveal.getByText("mock-Tongue-Eyelet-91")).toBeVisible();
  await reveal.getByRole("button", { name: "Hide and end" }).click();
  await expect(reveal).toBeHidden();
});

test("a secret is retired and restored", async ({ page }) => {
  await signInAsAlice(page, "/secret/mock-secret-db-reporting");
  await page.getByRole("button", { name: "Actions" }).click();
  await page.getByRole("menuitem", { name: "Retire" }).click();
  await expect(page.getByText(/^Retired on /)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/^Retired on /)).toBeVisible();
  await page.getByRole("button", { name: "Restore" }).first().click();
  await expect(page.getByText(/^Retired on /)).toBeHidden();
});
