import { expect, type Page, test } from "@playwright/test";

// The frame fills the viewport and only its main area scrolls: the document itself never
// scrolls, on a short page or a long one, and nothing inside a page (Radix's hidden form
// inputs, sr-only text) stretches it past the frame. Issue #225.
const navigate = (page: Page, to: string) =>
  page.evaluate(
    (route) =>
      (
        globalThis as unknown as {
          __reactRouterDataRouter: { navigate: (path: string) => void };
        }
      ).__reactRouterDataRouter.navigate(route),
    to,
  );

const documentSize = (page: Page) =>
  page.evaluate(() => {
    const root = document.scrollingElement!;
    return {
      clientHeight: root.clientHeight,
      clientWidth: root.clientWidth,
      scrollHeight: root.scrollHeight,
      scrollWidth: root.scrollWidth,
    };
  });

const signIn = async (page: Page) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await page.getByLabel("Admin name").fill("owner");
  await page.getByLabel("Password", { exact: true }).fill("any password at all");
  await page.getByLabel("Authenticator code").first().fill("123456");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/home", { timeout: 15_000 });
};

for (const viewport of [
  { height: 800, width: 1280 },
  { height: 844, width: 390 },
]) {
  test(`the document never scrolls past the frame at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await signIn(page);

    // Home is short; Access has switches and checkboxes (hidden inputs); Updates is long.
    for (const route of ["/home", "/access", "/certificates", "/updates"]) {
      await navigate(page, route);
      await page.waitForURL(`**${route}`);
      await expect(page.locator("#main h1")).toBeVisible();
      const size = await documentSize(page);
      expect(size.scrollHeight, `${route} height`).toBe(size.clientHeight);
      expect(size.scrollWidth, `${route} width`).toBe(size.clientWidth);
    }

    // A long page still scrolls, inside the main area.
    const main = page.locator("#main");
    const scrolled = await main.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
      return { overflows: element.scrollHeight > element.clientHeight, top: element.scrollTop };
    });
    expect(scrolled.overflows).toBe(true);
    expect(scrolled.top).toBeGreaterThan(0);
  });
}
