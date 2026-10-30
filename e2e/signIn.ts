import { expect, type Page } from "@playwright/test";

/** Sign Alice in through the local login and her authenticator code (mock fixtures). */
export const signInAsAlice = async (page: Page, start: string): Promise<void> => {
  await page.goto(start);
  await page.getByRole("link", { name: "Use local login instead" }).click();
  await page.getByLabel("Username or email").fill("alice");
  await page.getByLabel("Password").fill("any password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByLabel("6-digit code").fill("481027");
  // The welcome screen only shows for a moment before it opens the page, so wait for the page.
  await page.waitForURL((url) => !url.pathname.endsWith("/sign-in"));
};

/** Sign a mock user in through the mock's quick login, for a check of what someone else sees. */
export const signInAs = async (page: Page, userId: string, start: string): Promise<void> => {
  const response = await page.request.post("/sign-in", {
    form: { intent: "mock-quick-login", next: start, userId },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(302);
  await page.goto(start);
};

/** Switch to dark, then check the choice survives a reload (it lives in a cookie). */
export const switchToDark = async (page: Page): Promise<void> => {
  await page.getByRole("button", { name: "Accessibility settings" }).click();
  await page.getByRole("radio", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  await page.keyboard.press("Escape");
  await page.waitForLoadState("networkidle");
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
};

export const signOut = async (page: Page): Promise<void> => {
  await page.getByRole("button", { name: /Alice/ }).click();
  await page.getByRole("menuitem", { name: /Sign out/ }).click();
  await expect(page.getByRole("button", { name: "Sign in with SSO" })).toBeVisible();
};
