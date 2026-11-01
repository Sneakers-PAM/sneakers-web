import { expect, type Page } from "@playwright/test";

/** The steps, with the root size each one renders at. Normal is the 15px root of the design. */
const STEPS = [
  ["X-small", "12.75px"],
  ["Small", "13.875px"],
  ["Large", "17.25px"],
  ["X-large", "19.5px"],
  ["Normal", "15px"],
] as const;

const rootSize = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.documentElement).fontSize);

const rowsOfSizes = (page: Page) =>
  page.getByRole("radiogroup", { name: "Text size" }).evaluate((group) => {
    const tops = [...group.children].map((option) => option.getBoundingClientRect().top);
    return new Set(tops).size;
  });

/** Pick each text size from the Display panel and check what the browser actually renders. */
export const checkTextSizes = async (page: Page): Promise<void> => {
  expect(await rootSize(page)).toBe("15px");
  await page.getByRole("button", { name: "Accessibility settings" }).click();
  for (const [name, size] of STEPS) {
    await page.getByRole("radio", { exact: true, name }).click();
    await expect.poll(() => rootSize(page)).toBe(size);
    expect(await rowsOfSizes(page)).toBe(1);
  }
  await page.getByRole("radio", { exact: true, name: "Large" }).click();
  await expect.poll(() => rootSize(page)).toBe("17.25px");
  // The appliance admin saves to this browser; staff and admin post to a cookie, so let that land.
  await page.waitForLoadState("networkidle");
  await page.keyboard.press("Escape");
  await page.reload();
  await expect.poll(() => rootSize(page)).toBe("17.25px");
};
