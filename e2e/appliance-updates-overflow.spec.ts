import { expect, type Page, test } from "@playwright/test";

// Updates cards overflow with long build names: a lab build's version and its patch file name
// run long enough to wrap a "Fetch" button or push the "Running"/"staged" pill past its card.
// This renders the three cards with the longest real lab names on record (the "lab-names" mock
// scenario, app/mock/edge.mock.ts and app/mock/units.mock.ts) and checks that nothing in them
// scrolls sideways or wraps a button onto a second line, at the cards breakpoint's narrow side
// (one column) and three real desktop widths above it (three columns side by side).

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
// box, and every button inside it whose text wrapped onto a second line. An element that clips
// its own overflow on purpose (the short-label truncation) is supposed to have a scrollWidth
// bigger than its clientWidth -- that's the ellipsis working, not a layout bug -- so it's
// skipped; what matters is that nothing ABOVE it (an ancestor with normal overflow) got wider.
const overflowProblems = (root: HTMLElement): string[] => {
  const problems: string[] = [];
  for (const element of [root, ...root.querySelectorAll<HTMLElement>("*")]) {
    if (getComputedStyle(element).overflowX === "hidden") continue;
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
  return problems;
};

// 900: below the cards breakpoint (1100px), stacked to one column. 1280, 1440, 1920: real
// desktop widths, three columns side by side.
for (const width of [900, 1280, 1440, 1920]) {
  test(`the Updates cards don't overflow or wrap a button at ${width}px, with the longest real lab names`, async ({
    page,
  }) => {
    await page.setViewportSize({ height: 900, width });
    // The scenario is read when the app loads, so it rides along on the sign-in page's load;
    // the session it needs after that lives only in memory, so the rest of the trip stays a
    // client-side navigation.
    await page.goto("/?mockScenario=lab-names");
    await quickLogin(page);
    await navigate(page, "/updates");
    await page.waitForURL("**/updates");
    await waitForReady(page, "/updates");

    const cards = page.getByTestId("unit-cards");
    await expect(cards).toBeVisible();
    await expect(page.getByRole("button", { name: /^Fetch/ }).first()).toBeVisible();

    await page.screenshot({
      fullPage: true,
      path: `${process.env.SCREENSHOT_DIR ?? "."}/updates-lab-names-${String(width)}.png`,
    });

    const problems = await cards.evaluate(overflowProblems);
    expect(problems, problems.join("\n")).toEqual([]);
  });
}
