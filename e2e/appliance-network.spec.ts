import { expect, type Page, test } from "@playwright/test";

// The Network page stages a change, shows what a commit does, and commits it. The mock build
// holds the staged change and the refusals; its session lives in memory, so each test signs in
// on the URL that names its scenario and reaches Network with a client-side navigation.
const openNetwork = async (page: Page, scenarios: string) => {
  await page.goto(`/?mockScenario=${scenarios}`);
  await page.waitForFunction(() => document.documentElement.dataset.appReady === "/");
  await page.getByRole("combobox").click();
  await page.getByRole("option").first().click();
  await page.waitForURL("**/home", { timeout: 15_000 });
  await page.evaluate(() =>
    (
      globalThis as unknown as {
        __reactRouterDataRouter: { navigate: (path: string) => void };
      }
    ).__reactRouterDataRouter.navigate("/network"),
  );
  await expect(page.getByRole("heading", { name: "Network" })).toBeVisible();
};

test("a host name change stages, then commits", async ({ page }) => {
  await openNetwork(page, "air-gapped");
  await page.getByLabel("Hostname").fill("box.example.org");
  await page.getByRole("button", { name: "Stage change" }).click();
  await expect(page.getByText("A network change is staged")).toBeVisible();
  await page.getByRole("button", { name: "Commit" }).click();
  await expect(page.getByText(/Committed and kept/)).toBeVisible();
  await expect(page.getByText("A network change is staged")).toHaveCount(0);
});

test("a static address shows its fields and stages", async ({ page }) => {
  await openNetwork(page, "air-gapped");
  await page.getByRole("radiogroup", { name: "IPv6" }).getByText("Static").click();
  await page.getByLabel("IPv6 address").fill("2001:db8::10/64");
  await page.getByLabel("IPv6 gateway").fill("fe80::1");
  await page.getByRole("button", { name: "Stage change" }).click();
  await expect(page.getByText(/this page will drop/)).toBeVisible();
});

test("a dead gateway refuses the commit and leaves the change staged", async ({ page }) => {
  await openNetwork(page, "network-staged-moves,network-gateway-dead");
  await page.getByRole("button", { name: "Commit" }).click();
  await expect(page.getByText(/The gateway 192\.0\.2\.1 doesn't answer/).first()).toBeVisible();
  await expect(page.getByText("A network change is staged")).toBeVisible();
});

test("a commit that moves the address says where to reconnect when the page drops", async ({
  page,
}) => {
  await openNetwork(page, "network-staged-moves,network-commit-drops");
  await expect(page.getByRole("link", { name: "https://192.0.2.60:8443/" })).toBeVisible();
  await page.getByRole("button", { name: "Commit" }).click();
  await expect(page.getByText(/stopped answering here/)).toBeVisible();
  await expect(page.getByRole("link", { name: "https://192.0.2.60:8443/" })).toBeVisible();
  await expect(page.getByText("A network change is staged")).toHaveCount(0);
});
