#!/usr/bin/env node
// The appliance admin review gallery: the mock build (fixture data, no box needed) served the
// way osadmin serves it, with its CSP header (e2e/applianceAdminServer.mjs), opened in headless
// Chrome. Each route is shot at 1280 and 390 px once the running app has set its ready marker
// (`data-app-ready` on <html>, app/lib/readiness.ts). Any console error, page error or CSP
// violation fails the run, and so does a route that never gets ready.
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
const SIGNED_OUT = ["/sign-in", "/setup", "/no-such-page"];
const FRAME = [
  "/",
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

const slug = (route) => (route === "/" ? "status" : route.slice(1).replaceAll("/", "-"));

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

const watch = (page, problems, label) => {
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(`${label}: console error: ${message.text()}`);
  });
  page.on("pageerror", (error) => problems.push(`${label}: page error: ${error.message}`));
  page.on("requestfailed", (request) =>
    problems.push(`${label}: request failed: ${request.url()} ${request.failure()?.errorText}`),
  );
};

const shoot = async (page, shots, size, route) => {
  const landed = await waitForReady(page, route);
  const file = `${slug(route)}-${size.name}.png`;
  await page.screenshot({ fullPage: true, path: path.join(out, file) });
  shots.push({ file, landed, route, size: size.name });
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
            `<figure><a href="${s.file}"><img alt="${route} ${s.size}" src="${s.file}"></a><figcaption>${s.size}${s.landed === route ? "" : `, landed on ${s.landed}`}</figcaption></figure>`,
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
  browser = await chromium.launch(
    process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
  );
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
    // The dev quick login opens a Radix select, so the run also covers its scroll lock.
    await page.goto(`${base}/sign-in`);
    await waitForReady(page, "/sign-in");
    await page.getByRole("combobox").click();
    await page.getByRole("option").first().click();
    for (const route of FRAME) {
      await page.evaluate((to) => globalThis.__reactRouterDataRouter.navigate(to), route);
      await page.waitForURL(`${base}${route}`);
      await shoot(page, shots, size, route);
    }
    await context.close();
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
