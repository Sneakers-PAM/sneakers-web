import { expect, test } from "@playwright/test";

test("a fresh install walks through first-run setup to sign-in", async ({ page }) => {
  await page.goto("/admin/users");
  await expect(page.getByRole("heading", { name: "Set up Sneakers-PAM" })).toBeVisible();
  await page.getByRole("link", { name: "Start setup" }).click();

  await page.getByLabel(/Username/).fill("root");
  await page.getByLabel(/Display name/).fill("Rosa");
  await page.getByLabel(/Email/).fill("rosa@example.org");
  await page.getByLabel(/^Password/).fill("correct horse battery");
  await page.getByLabel(/Confirm password/).fill("correct horse battery");
  await page.getByLabel(/Setup token/).fill("mock-setup-token");
  await page.getByRole("button", { name: "Create admin" }).click();

  await expect(page.getByRole("heading", { name: "Verify your email" })).toBeVisible();
  await page.getByLabel("6-digit code").fill("481027");
  await expect(page.getByRole("heading", { name: "You're all set" })).toBeVisible();
  await page.getByRole("link", { name: "Continue to sign-in" }).click();
  await expect(page).toHaveURL(/\/admin\/sign-in/);
  await expect(page.getByRole("heading", { name: "Set up Sneakers-PAM" })).toBeHidden();
});
