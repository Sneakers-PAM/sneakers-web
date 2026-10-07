import { defineConfig, devices } from "@playwright/test";

// End-to-end checks run both apps' mock builds: the real servers, with the gateway answered
// in-process from fixtures. CHROME_PATH points at an installed Chrome when Playwright's own
// browser isn't downloaded.
const STAFF_PORT = 4176;
const ADMIN_PORT = 4177;
// A second admin server that starts as a fresh install, for first-run setup.
const FRESH_PORT = 4178;
// The appliance admin's live build, served with osadmin's headers (e2e/applianceAdminServer.mjs).
const APPLIANCE_PORT = 4179;

// The staff server trusts a proxy in front of it and the admin server doesn't, so e2e/proxy.spec.ts
// can check both.
const serve = (app: string, port: number, trustProxy?: string) => ({
  command: `npm run build:mock -w @sneakers-web/${app} && npm run start:mock -w @sneakers-web/${app}`,
  env: {
    APP_ENV: "dev",
    LOG_LEVEL: "warn",
    PORT: String(port),
    ...(trustProxy ? { TRUST_PROXY: trustProxy } : {}),
  },
  // Never test a server something else started: a busy port fails the run straight away.
  reuseExistingServer: false,
  timeout: 180_000,
  url: `http://127.0.0.1:${port}${app === "admin" ? "/admin" : ""}/healthz`,
});

// It reuses the admin build (two builds into one folder would race), so it waits for the
// admin server first.
const fresh = {
  command: `node e2e/waitFor.mjs http://127.0.0.1:${ADMIN_PORT}/admin/healthz && npm run start:mock -w @sneakers-web/admin`,
  env: { APP_ENV: "dev", LOG_LEVEL: "warn", MOCK_FRESH_INSTALL: "1", PORT: String(FRESH_PORT) },
  reuseExistingServer: false,
  timeout: 300_000,
  url: `http://127.0.0.1:${FRESH_PORT}/admin/healthz`,
};

const appliance = {
  command: "npm run build -w @sneakers-web/appliance-admin && node e2e/applianceAdminServer.mjs",
  env: { PORT: String(APPLIANCE_PORT) },
  reuseExistingServer: false,
  timeout: 180_000,
  url: `http://127.0.0.1:${APPLIANCE_PORT}/favicon.svg`,
};

export default defineConfig({
  forbidOnly: !!process.env.CI,
  projects: [
    {
      name: "staff",
      testMatch: /staff(-[a-z-]+)?\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"], baseURL: `http://127.0.0.1:${STAFF_PORT}` },
    },
    { name: "proxy", testMatch: "proxy.spec.ts" },
    {
      name: "admin",
      testMatch: "admin.spec.ts",
      use: { ...devices["Desktop Chrome"], baseURL: `http://127.0.0.1:${ADMIN_PORT}` },
    },
    {
      name: "setup",
      testMatch: "setup.spec.ts",
      use: { ...devices["Desktop Chrome"], baseURL: `http://127.0.0.1:${FRESH_PORT}` },
    },
    {
      name: "appliance-csp",
      testMatch: "appliance-csp.spec.ts",
      use: { ...devices["Desktop Chrome"], baseURL: `http://127.0.0.1:${APPLIANCE_PORT}` },
    },
  ],
  reporter: process.env.CI ? "github" : "list",
  retries: process.env.CI ? 1 : 0,
  testDir: "e2e",
  use: {
    launchOptions: process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
    trace: "retain-on-failure",
  },
  webServer: [serve("staff", STAFF_PORT, "1"), serve("admin", ADMIN_PORT), fresh, appliance],
});
