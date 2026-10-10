import { expect, type Page, test } from "@playwright/test";

// Versions overflow their boxes and buttons (round 2): a lab build's version used to be shown
// as one long string, shortened with an ellipsis and a "Full version" dropdown -- which itself
// turned out to look bad and clip its last character. It's now read apart into fields (the
// build name large, a channel badge, the small labelled facts) with a copy icon, so nothing
// needs truncating and there's no disclosure to open. This renders Updates, Home and Access
// with the longest real lab build on record (the "lab-names" mock scenario, app/mock/edge.mock.ts
// and app/mock/units.mock.ts) and checks that nothing scrolls sideways, no button wraps onto a
// second line, and no page has a `<details>` left in it -- at a mobile width and three real
// desktop widths, the smallest (1280) being under the 1440px sizing base.
//
// Access also used to need a sideways scroll of its own on the Admins table at every desktop
// width, which hid the actions column behind the scrollbar; the three desktop widths below also
// check that table doesn't need one, and that its actions stay in view without scrolling.

const waitForReady = (page: Page, route: string) =>
  page.waitForFunction((path) => document.documentElement.dataset.appReady === path, route, {
    timeout: 15_000,
  });

// A client-side navigation, the way the app's own links do it: a `page.goto` to anywhere but
// the sign-in page would reload the bundle and lose the mock session (it lives in memory, not
// a cookie -- the gallery's own review shots hit the same thing).
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

/** Signs in with the dev quick login's first user, on a sign-in page already loaded. */
const quickLogin = async (page: Page) => {
  await waitForReady(page, "/");
  await page.getByRole("combobox").click();
  await page.getByRole("option").first().click();
  await page.waitForURL("**/home", { timeout: 15_000 });
};

// Runs in the browser: every element under `root` (root included) that scrolls past its own
// box, every button inside it whose text wrapped onto a second line, and every `<details>` --
// the fields redesign leaves none, where the version used to hide behind one.
const overflowProblems = (root: HTMLElement): string[] => {
  const problems: string[] = [];
  for (const element of [root, ...root.querySelectorAll<HTMLElement>("*")]) {
    // "hidden" (an ellipsis) and "auto"/"scroll" (a table that means to scroll sideways on a
    // narrow screen) both handle their own overflow on purpose; only "visible" spilling past
    // the box is a layout bug.
    if (["auto", "hidden", "scroll"].includes(getComputedStyle(element).overflowX)) continue;
    if (element.scrollWidth > element.clientWidth + 1) {
      problems.push(
        `${element.tagName.toLowerCase()}"${element.className}" overflows: scrollWidth ${element.scrollWidth} > clientWidth ${element.clientWidth}`,
      );
    }
  }
  for (const button of root.querySelectorAll<HTMLElement>("button")) {
    if (button.scrollHeight > button.clientHeight + 1) {
      problems.push(
        `button "${button.textContent ?? ""}" wrapped: scrollHeight ${button.scrollHeight} > clientHeight ${button.clientHeight}`,
      );
    }
  }
  if (root.querySelector("details")) problems.push("a <details> element is still in the page");
  return problems;
};

const check = async (page: Page, route: string, selector: string, name: string) => {
  await navigate(page, route);
  await page.waitForURL(`**${route}`);
  await waitForReady(page, route);
  const scope = page.locator(selector);
  await expect(scope).toBeVisible();
  await page.screenshot({
    fullPage: true,
    path: `${process.env.SCREENSHOT_DIR ?? "."}/${name}.png`,
  });
  const problems = await scope.evaluate(overflowProblems);
  expect(problems, problems.join("\n")).toEqual([]);
};

// The width of a page's own content column, the first thing #main renders -- used to catch a
// page that caps itself below the others instead of filling #main like they do. Issue #263.
const contentWidth = async (page: Page, route: string) => {
  await navigate(page, route);
  await page.waitForURL(`**${route}`);
  await waitForReady(page, route);
  return page
    .locator("#main > :first-child")
    .evaluate((element) => element.getBoundingClientRect().width);
};

// 390: a mobile width. 1280, 1440, 1920: real desktop widths; 1440 is the sizing base, 1280 is
// under it.
for (const width of [390, 1280, 1440, 1920]) {
  test(`Updates, Home and Access don't overflow, wrap a button or leave a disclosure open at ${width}px, with the longest real lab build`, async ({
    page,
  }) => {
    await page.setViewportSize({ height: 900, width });
    // The scenario is read when the app loads, so it rides along on the sign-in page's load;
    // the session it needs after that lives only in memory, so the rest of the trip stays a
    // client-side navigation.
    await page.goto("/?mockScenario=lab-names");
    await quickLogin(page);

    await check(page, "/updates", "[data-testid=unit-cards]", `updates-lab-names-${String(width)}`);
    await expect(page.getByRole("button", { name: /^Fetch/ }).first()).toBeVisible();

    await check(page, "/home", "#main", `home-lab-names-${String(width)}`);
    // The full raw version never shows by default; its parts do (e.g. "Line 0.0.0-lab").
    await expect(
      page.getByText("0.0.0-lab.20261009m2.r20261010031325-g79c3ceb", { exact: false }),
    ).toHaveCount(0);

    await check(page, "/access", "#main", `access-${String(width)}`);
    if (width !== 390) {
      const admins = page.getByRole("table", { name: "Admins" });
      const overflowX = await admins.evaluate((table) => {
        const wrapper = table.parentElement as HTMLElement;
        return wrapper.scrollWidth - wrapper.clientWidth;
      });
      expect(
        overflowX,
        `the Admins table needs ${String(overflowX)}px of sideways scroll at ${String(width)}px`,
      ).toBeLessThanOrEqual(0);
      await expect(page.getByRole("button", { name: "Remove admin" }).first()).toBeInViewport();

      // Root shell's content used to sit in a max-w-3xl box, well short of Home's full column.
      await check(page, "/root-shell", "#main", `root-shell-lab-names-${String(width)}`);
      const homeWidth = await contentWidth(page, "/home");
      const rootShellWidth = await contentWidth(page, "/root-shell");
      expect(
        rootShellWidth,
        `root shell's content is ${String(rootShellWidth)}px, home's is ${String(homeWidth)}px, at ${String(width)}px`,
      ).toBeGreaterThanOrEqual(homeWidth - 1);
    }
  });
}
