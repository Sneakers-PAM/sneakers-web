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
