import { expect, type Page, test } from "@playwright/test";

/** Client-side navigation, the way the gallery script drives the SPA (no full page load). */
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

// The built, LIVE appliance admin (no mock) against a backend shaped like the real box's
// current state (e2e/applianceRealBackendServer.mjs): TlsService, McpService, BackupService
// and ModulesService answer "unimplemented", and UpgradeService leaves out an empty
// `history`. Issue #201: those pages used to crash or stay blank. Every page here has to
// render -- with "Not available in this release" where the box doesn't have it yet -- and
// never throw a console or page error.
const UNAVAILABLE = [
  { heading: "Certificates", name: "Certificates", route: "/certificates" },
  { heading: "Backups", name: "Backups", route: "/backups" },
  { heading: "MCP", name: "MCP", route: "/mcp" },
  { heading: "Add-on modules", name: "Add-on modules", route: "/modules" },
] as const;

const AVAILABLE = ["/home", "/network", "/access", "/logs", "/power"] as const;

test("every page renders against a real-shaped backend, with unimplemented pages showing Not available", async ({
  page,
}) => {
  const problems: string[] = [];
  page.on("console", (message) => {
    // The browser logs the 501s Tls/Mcp/Backup/Modules answer as network errors in their own
    // right; that is the scenario under test, not a bug -- isNotAvailable's catch is what
    // matters, and the pages below assert it ran.
    if (message.type() === "error" && !/failed to load resource/i.test(message.text())) {
      problems.push(`console error: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => problems.push(`page error: ${error.message}`));

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  // SignInService/PollSignIn approves on the first poll (every 2s, useSignInCode.ts).
  await page.waitForURL("**/home", { timeout: 15_000 });

  for (const route of AVAILABLE) {
    await navigate(page, route);
    await page.waitForURL(`**${route}`);
  }

  // Updates leaves `history` out of the reply; the page used to throw a TypeError on it.
  await navigate(page, "/updates");
  await page.waitForURL("**/updates");
  await expect(page.getByText("Running 0.1.0 in the active slot")).toBeVisible();
  await expect(page.getByRole("table", { name: "Update history" }).getByRole("row")).toHaveCount(1);

  for (const { heading, name, route } of UNAVAILABLE) {
    await navigate(page, route);
    await page.waitForURL(`**${route}`);
    await expect(page.getByText(`${name}: not available in this release`)).toBeVisible();
    expect(await page.getByRole("heading", { name: heading }).count()).toBe(0);
  }

  expect(problems).toEqual([]);
});
