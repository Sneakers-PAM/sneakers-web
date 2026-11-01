import { expect, test } from "@playwright/test";

import { signInAsAlice } from "./signIn";

const SECRET = "/secret/mock-secret-edge-router";

for (const viewport of [
  { height: 900, width: 1440 },
  { height: 844, width: 390 },
  { height: 900, width: 640 },
]) {
  test(`a toast sits bottom center, clear of the Display button, at ${viewport.width}px`, async ({
    context,
    page,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.setViewportSize(viewport);
    await signInAsAlice(page, SECRET);
    await page.getByRole("button", { name: "Copy secret id" }).click();

    const shown = page.locator("[data-sonner-toast]").first();
    await expect(shown).toBeVisible();
    await expect(shown).toHaveAttribute("data-mounted", "true");
    const button = page.getByRole("button", { name: "Accessibility settings" });
    // It slides in, so measure once it has settled.
    await expect(async () => {
      const toast = (await shown.boundingBox())!;
      const display = (await button.boundingBox())!;
      expect(Math.abs(toast.x + toast.width / 2 - viewport.width / 2)).toBeLessThanOrEqual(1);
      expect(toast.y + toast.height).toBeLessThanOrEqual(display.y);
      expect(toast.y + toast.height).toBeGreaterThan(viewport.height / 2);
    }).toPass({ timeout: 2000 });
  });
}
