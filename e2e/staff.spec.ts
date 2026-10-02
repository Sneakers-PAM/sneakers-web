import { expect, test } from "@playwright/test";

import { signInAsAlice, signOut, switchToDark } from "./signIn";

test("the staff app signs in, keeps the theme and signs out", async ({ page }) => {
  await signInAsAlice(page, "/checkouts");
  await expect(page).toHaveURL(/\/checkouts$/);
  await expect(page.getByTestId("edge-banner")).toHaveText(/MOCK DATA, not a real server/);
  await expect(page.getByRole("heading", { name: "Checkouts" })).toBeVisible();

  await switchToDark(page);
  await signOut(page);

  await page.goto("/");
  await expect(page).toHaveURL(/\/sign-in\?next=%2F$/);
});

test("a wrong code is refused", async ({ page }) => {
  await page.goto("/sign-in?view=local");
  await page.getByLabel("Username or email").fill("alice");
  await page.getByLabel("Password").fill("x");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByLabel("6-digit code").fill("000000");
  await expect(page.getByText(/That code didn.t work/)).toBeVisible();
});

test.describe("on a phone", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { height: 844, width: 390 } });

  test("the header fits: the account menu is fully on screen", async ({ page }) => {
    await signInAsAlice(page, "/");
    const account = page.getByRole("button", { name: /Alice/ });
    await expect(account).toBeVisible();
    const box = await account.boundingBox();
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(390);
  });
});
