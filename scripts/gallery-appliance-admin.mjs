#!/usr/bin/env node
// The appliance admin review gallery: the mock build (fixture data, no box needed) served the
// way osadmin serves it, with its CSP header (e2e/applianceAdminServer.mjs), opened in headless
// Chrome. Each route is shot at 1280 and 390 px once the running app has set its ready marker
// (`data-app-ready` on <html>, app/lib/readiness.ts). Any console error, page error or CSP
// violation fails the run, and so does a route that never gets ready.
//
// A second, "real backend, not implemented" pass (issue #201) shoots the same frame routes
// from the LIVE build against e2e/applianceRealBackendServer.mjs: a box shaped like a real
// one today, where TlsService, McpService, BackupService and ModulesService answer
// "unimplemented" and UpgradeService leaves out an empty history. Those pages have to show
// "Not available in this release" instead of crashing or staying blank.
//
//   npm run gallery:appliance-admin                 # writes apps/appliance-admin/gallery
//   GALLERY_DIR=/some/folder npm run gallery:appliance-admin
//
// CHROME_PATH points at an installed Chrome when Playwright's own browser isn't downloaded.
import { spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import path from "node:path";
import { chromium } from "playwright";

const root = path.resolve(import.meta.dirname, "..");
const out = path.resolve(
  process.env.GALLERY_DIR ?? path.join(root, "apps/appliance-admin/gallery"),
);
const WIDTHS = [
  { height: 900, name: "desktop", width: 1280 },
  { height: 844, name: "mobile", width: 390 },
];
// Pages a signed-out browser reaches by URL, then the frame's pages after the dev quick login.
const SIGNED_OUT = ["/", "/setup", "/no-such-page", "/unauthorized", "/forbidden", "/server-error"];
const FRAME = [
  "/home",
  "/updates",
  "/network",
  "/access",
  "/certificates",
  "/backups",
  "/mcp",
  "/modules",
  "/logs",
  "/power",
];
// Pages shot again with the mock box in a scenario (`?mockScenario=`, app/mock/edge.mock.ts),
// for the states a fresh mock box doesn't show. The name is the shot's file prefix.
const SCENARIOS = [
  { name: "updates-elevated", route: "/updates", scenario: "staged,elevated" },
  { name: "access-locked-invited", route: "/access", scenario: "locked,invited,elevated" },
  {
    act: async (page) => {
      await page.getByRole("button", { name: "Get an SSH key" }).click();
      await page.getByRole("dialog").getByLabel("Label").fill("work laptop");
      await page.getByRole("button", { name: "Make the key" }).click();
      await page.getByText("This is shown once").waitFor();
    },
    name: "access-ssh-key",
    route: "/access",
    scenario: "",
  },
  {
    act: async (page) => {
      const form = page.getByRole("form", { name: "Add an admin" });
      await form.getByRole("textbox", { name: "Name" }).fill("carol");
      await form.getByRole("button", { name: "Add admin" }).click();
      await page.getByText("Invitation for carol").waitFor();
    },
    name: "access-invitation",
    route: "/access",
    scenario: "",
  },
];
// Signed-out pages in a scenario: the setup stepper's steps as a reload finds them, each with
// an optional `act` that drives the page further before the shot.
const SIGNED_OUT_SCENARIOS = [
  { name: "setup-1-code", route: "/setup", scenario: "first-boot" },
  { name: "setup-2-admin", route: "/setup", scenario: "setup-admin" },
  {
    act: async (page) => {
      await page.getByLabel("Admin name").fill("alice");
      await page.getByLabel("Password", { exact: true }).fill("correct horse battery staple");
      await page.getByLabel("Password again", { exact: true }).fill("correct horse battery staple");
      await page.getByText("Strong enough.").waitFor();
      await page.getByRole("button", { name: "Continue" }).click();
      await page.getByText("Add your authenticator").waitFor();
    },
    name: "setup-2-authenticator",
    route: "/setup",
    scenario: "setup-admin",
  },
  { name: "setup-3-recovery-keys", route: "/setup", scenario: "setup-keys" },
  { name: "setup-4-network", route: "/setup", scenario: "setup-network" },
  { name: "setup-5-protection", route: "/setup", scenario: "setup-protection" },
  { name: "setup-5-protection-reduced", route: "/setup", scenario: "setup-protection,reduced" },
  { name: "setup-6-finish", route: "/setup", scenario: "setup-finish" },
];
const READY_TIMEOUT_MS = 15_000;
// The marker has to hold this long: a page that answers one call and starts the next would
// otherwise look ready in between.
const SETTLE_MS = 300;

const freePort = () =>
  new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });

const waitForServer = async (url) => {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`the gallery server never answered at ${url}`);
};

const slug = (route) => (route === "/" ? "sign-in" : route.slice(1).replaceAll("/", "-"));

/** Signs in with the dev quick login's first user, on a sign-in page already loaded. */
const quickLogin = async (page) => {
  await waitForReady(page, "/");
  await page.getByRole("combobox").click();
  await page.getByRole("option").first().click();
};

/** Waits for the app's own ready marker on the page it landed on, and returns that path. */
const waitForReady = async (page, route) => {
  try {
    await page.waitForFunction(
      async (settleMs) => {
        if (document.documentElement.dataset.appReady !== location.pathname) return false;
        await new Promise((resolve) => setTimeout(resolve, settleMs));
        return document.documentElement.dataset.appReady === location.pathname;
      },
      SETTLE_MS,
      { polling: 100, timeout: READY_TIMEOUT_MS },
    );
  } catch {
    throw new Error(`${route} never reached ready (data-app-ready on <html>)`);
  }
  return page.evaluate(() => location.pathname);
};

const watch = (page, problems, label, { ignoreFailedResource = false } = {}) => {
  page.on("console", (message) => {
    // The real-backend pass's 501s show up as their own "failed to load resource" console
    // error; that is the scenario under test (isNotAvailable's catch is what matters), not a
    // bug.
    if (ignoreFailedResource && /failed to load resource/i.test(message.text())) return;
    if (message.type() === "error") problems.push(`${label}: console error: ${message.text()}`);
  });
  page.on("pageerror", (error) => problems.push(`${label}: page error: ${error.message}`));
  page.on("requestfailed", (request) =>
    problems.push(`${label}: request failed: ${request.url()} ${request.failure()?.errorText}`),
  );
};

/** Signs in through the form (applianceRealBackendServer.mjs takes any name, password and
 * code), the way an admin does on a real box. */
const liveSignIn = async (page, realBase) => {
  await page.goto(realBase);
  await waitForReady(page, "/");
  await page.getByLabel("Admin name").fill("owner");
  await page.getByLabel("Password", { exact: true }).fill("any password at all");
  await page.getByLabel("Authenticator code").first().fill("123456");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(`${realBase}/home`, { timeout: 15_000 });
};

const shoot = async (page, shots, size, route, name = slug(route), label = route) => {
  const landed = await waitForReady(page, route);
  const file = `${name}-${size.name}.png`;
  await page.screenshot({ fullPage: true, path: path.join(out, file) });
  shots.push({ file, landed, path: route, route: label, size: size.name });
  console.log(
    `gallery: ${route} at ${size.width}px${landed === route ? "" : ` (landed on ${landed})`}`,
  );
};

const indexPage = (shots) => {
  const routes = [...new Set(shots.map((s) => s.route))];
  const rows = routes
    .map((route) => {
      const cells = shots
        .filter((s) => s.route === route)
        .map(
          (s) =>
            `<figure><a href="${s.file}"><img alt="${route} ${s.size}" src="${s.file}"></a><figcaption>${s.size}${s.landed === s.path ? "" : `, landed on ${s.landed}`}</figcaption></figure>`,
        )
        .join("");
      return `<section><h2>${route}</h2><div class="row">${cells}</div></section>`;
    })
    .join("\n");
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Appliance admin gallery</title>
<style>
body{font-family:system-ui,sans-serif;margin:24px;background:#f4f5f6;color:#1d252b}
.row{display:flex;gap:16px;align-items:flex-start}
figure{margin:0;background:#fff;padding:8px;border:1px solid #d5d9dc}
img{display:block;max-height:640px;width:auto}
figcaption{font-size:13px;margin-top:4px;color:#556}
</style></head><body>
<h1>Appliance admin gallery</h1>
<p>The mock build, served with osadmin's CSP, in headless Chrome. Generated ${new Date().toISOString()}.</p>
${rows}
</body></html>
`;
};

const port = await freePort();
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, [path.join(root, "e2e/applianceAdminServer.mjs")], {
  env: { ...process.env, APP_BUILD_DIR: "build-mock", PORT: String(port) },
  stdio: "inherit",
});
const problems = [];
const shots = [];
let browser;
try {
  await waitForServer(`${base}/favicon.svg`);
  rmSync(out, { force: true, recursive: true });
  mkdirSync(out, { recursive: true });
  browser = await chromium.launch({
    // Without these, a screenshot hangs forever on a host with no GPU (a container, most
    // CI runners): Chrome's compositor never finishes the frame it's handed to.
    args: ["--disable-gpu", "--disable-software-rasterizer"],
    ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
  });
  for (const size of WIDTHS) {
    const context = await browser.newContext({
      viewport: { height: size.height, width: size.width },
    });
    await context.addInitScript(() => {
      document.addEventListener("securitypolicyviolation", (event) => {
        console.error(
          `CSP violation: ${event.violatedDirective} ${event.blockedURI} at ${event.sourceFile}:${event.lineNumber}:${event.columnNumber}`,
        );
      });
    });
    const page = await context.newPage();
    watch(page, problems, `${size.width}px`);
    for (const route of SIGNED_OUT) {
      await page.goto(`${base}${route}`);
      await shoot(page, shots, size, route);
    }
    for (const { act, name, route, scenario } of SIGNED_OUT_SCENARIOS) {
      await page.goto(`${base}${route}?mockScenario=${scenario}`);
      await waitForReady(page, route);
      if (act) await act(page);
      await shoot(page, shots, size, route, name, `${route} (${name})`);
    }
    // The dev quick login opens a Radix select, so the run also covers its scroll lock.
    await page.goto(`${base}/`);
    await quickLogin(page);
    for (const route of FRAME) {
      await page.evaluate((to) => globalThis.__reactRouterDataRouter.navigate(to), route);
      await page.waitForURL(`${base}${route}`);
      await shoot(page, shots, size, route);
    }
    // A scenario is read when the app loads, and the session lives in memory, so each one is a
    // fresh load of the sign-in page with the scenario, then the quick login again.
    for (const { act, name, route, scenario } of SCENARIOS) {
      await page.goto(`${base}/?mockScenario=${scenario}`);
      await quickLogin(page);
      await page.evaluate((to) => globalThis.__reactRouterDataRouter.navigate(to), route);
      await page.waitForURL(`${base}${route}`);
      if (act) {
        await waitForReady(page, route);
        await act(page);
      }
      await shoot(page, shots, size, route, name, `${route} (${scenario || name})`);
    }
    await context.close();
  }

  // Second pass: the LIVE build (not mock) against a backend shaped like a real box today
  // (issue #201's "real backend, not implemented"). Desktop only, to keep this cheap; the
  // first pass above already covers both widths and every other state.
  const port2 = await freePort();
  const base2 = `http://127.0.0.1:${port2}`;
  const server2 = spawn(process.execPath, [path.join(root, "e2e/applianceRealBackendServer.mjs")], {
    env: { ...process.env, APP_BUILD_DIR: "build", PORT: String(port2) },
    stdio: "inherit",
  });
  try {
    await waitForServer(`${base2}/favicon.svg`);
    const context = await browser.newContext({
      viewport: { height: WIDTHS[0].height, width: WIDTHS[0].width },
    });
    const page = await context.newPage();
    watch(page, problems, "real backend", { ignoreFailedResource: true });
    await liveSignIn(page, base2);
    for (const route of FRAME) {
      await page.evaluate((to) => globalThis.__reactRouterDataRouter.navigate(to), route);
      await page.waitForURL(`${base2}${route}`);
      await shoot(page, shots, WIDTHS[0], route, `real-${slug(route)}`, `${route} (real backend)`);
    }
    await context.close();
  } finally {
    server2.kill();
  }

  writeFileSync(path.join(out, "index.html"), indexPage(shots));
} finally {
  await browser?.close();
  server.kill();
}

if (problems.length > 0) {
  for (const problem of problems) console.error(problem);
  console.error(`gallery: ${problems.length} problem(s); the gallery in ${out} is not a pass`);
  process.exit(1);
}
console.log(
  `gallery: ${shots.length} shots, no console errors or CSP violations: ${out}/index.html`,
);
