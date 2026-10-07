import { expect, test } from "@playwright/test";

import { OSADMIN_CSP, SIGN_IN_CODE } from "./applianceCsp";

// The built appliance admin, served with osadmin's real Content-Security-Policy. Component
// tests never apply the header, so only a real browser shows a blocked script or style.
test("the sign-in page renders and runs under osadmin's CSP", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (message) => {
    if (/content security policy/i.test(message.text())) violations.push(message.text());
  });
  page.on("pageerror", (error) => violations.push(`page error: ${error.message}`));
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (event) => {
      console.error(
        `Content Security Policy violation: ${event.violatedDirective} ${event.blockedURI}`,
      );
    });
  });

  const response = await page.goto("/");
  expect(response?.headers()["content-security-policy"]).toBe(OSADMIN_CSP);

  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  // The code comes from BeginSignIn, so it only shows once the bundle has run and called the API.
  await expect(page.getByLabel(`Sign-in code ${SIGN_IN_CODE}`)).toBeVisible();
  expect(violations).toEqual([]);
});
