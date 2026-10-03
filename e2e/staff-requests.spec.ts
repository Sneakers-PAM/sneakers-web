import { expect, test } from "@playwright/test";

import { signInAsAlice } from "./signIn";

test("an approver reviews and approves a request, then checks a secret in", async ({ page }) => {
  await signInAsAlice(page, "/requests");
  await expect(page.getByRole("heading", { name: "Access requests" })).toBeVisible();

  const awaiting = page.getByRole("region", { name: "Awaiting your approval" });
  await awaiting
    .getByRole("row", { name: /DB admin/ })
    .getByRole("button", { name: /Review/ })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Read-only access for the quarterly report.")).toBeVisible();
  await dialog.getByLabel("Message").fill("Approving for the report run.");
  await dialog.getByLabel("Message").press("Enter");
  await expect(dialog.getByText("Approving for the report run.")).toBeVisible();
  await dialog.getByRole("button", { name: "24 h" }).click();
  await dialog.getByRole("button", { name: "Approve for 24h" }).click();
  await expect(page.getByText("Approved for 24 h. Dave was notified.").first()).toBeVisible();
  await expect(
    page.getByRole("region", { name: "History" }).getByRole("row", { name: /DB admin/ }),
  ).toBeVisible();

  await page.goto("/checkouts");
  await expect(page.getByRole("heading", { name: "Your checkouts" })).toBeVisible();
  await page.getByRole("button", { name: "Check in Acme VPN" }).click();
  await expect(page.getByText("Acme VPN is checked in. It rotates now.").first()).toBeVisible();
  await expect(page.getByText("No active checkouts")).toBeVisible();
});

test("a secret's page links to the request form", async ({ page }) => {
  await signInAsAlice(page, "/requests?new=mock-secret-helpdesk");
  const dialog = page.getByRole("dialog", { name: "Request access to Helpdesk reset account" });
  await dialog.getByLabel(/Why do you need it/).fill("Covering the helpdesk this week.");
  await dialog.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByText("Request sent. An approver will look at it.").first()).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Your open requests" })
      .getByRole("row", { name: /Helpdesk reset account/ }),
  ).toBeVisible();
});
