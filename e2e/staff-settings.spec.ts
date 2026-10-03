import { expect, test } from "@playwright/test";

// Bob starts with no second factor and ends with none, so the shared mock server is left as
// the other specs expect it.
test("someone adds an authenticator from the Security page, then removes it", async ({ page }) => {
  await page.goto("/security?setup=authenticator");
  await page.getByRole("link", { name: "Use local login instead" }).click();
  await page.getByLabel("Username or email").fill("bob");
  await page.getByLabel("Password").fill("any password");
  await page.getByRole("button", { name: "Sign in" }).click();

  const setup = page.getByRole("dialog", { name: "Set up a second factor" });
  await expect(setup.getByText("JBSW Y3DP EHPK 3PXP")).toBeVisible();
  await setup.getByLabel("6-digit code").fill("000000");
  await expect(setup.getByText(/That code didn.t match/)).toBeVisible();
  await setup.getByLabel("6-digit code").fill("123456");
  await expect(page.getByText("Authenticator app added.").first()).toBeVisible();

  const app = page.getByRole("group", { name: "Authenticator app" });
  await expect(app.getByText(/^Added \d{1,2} \w+ \d{4}\.$/)).toBeVisible();
  await app.getByRole("button", { name: "Remove…" }).click();
  await page
    .getByRole("alertdialog", { name: "Remove your authenticator?" })
    .getByRole("button", { name: "Remove authenticator" })
    .click();
  // Confirming the new code counts as a fresh second factor, so no step-up is asked here.
  await expect(page.getByText("Your session ended. Sign in again to carry on.")).toBeVisible();
});
