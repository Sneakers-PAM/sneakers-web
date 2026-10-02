import { defineConfig, devices } from "@playwright/test";

// End-to-end checks run both apps' mock builds: the real servers, with the gateway answered
// in-process from fixtures. CHROME_PATH points at an installed Chrome when Playwright's own
// browser isn't downloaded.
const STAFF_PORT = 4176;
const ADMIN_PORT = 4177;

const serve = (app: string, port: number) => ({
  command: `npm run build:mock -w @sneakers-web/${app} && npm run start:mock -w @sneakers-web/${app}`,
  env: { APP_ENV: "dev", LOG_LEVEL: "warn", PORT: String(port) },
  reuseExistingServer: !process.env.CI,
  timeout: 180_000,
  url: `http://127.0.0.1:${port}${app === "admin" ? "/admin" : ""}/healthz`,
});

export default defineConfig({
  forbidOnly: !!process.env.CI,
  projects: [
    {
      name: "staff",
      testMatch: "staff.spec.ts",
      use: { ...devices["Desktop Chrome"], baseURL: `http://127.0.0.1:${STAFF_PORT}` },
    },
    {
      name: "admin",
      testMatch: "admin.spec.ts",
      use: { ...devices["Desktop Chrome"], baseURL: `http://127.0.0.1:${ADMIN_PORT}` },
    },
  ],
  reporter: process.env.CI ? "github" : "list",
  retries: process.env.CI ? 1 : 0,
  testDir: "e2e",
  use: {
    launchOptions: process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
    trace: "retain-on-failure",
  },
  webServer: [serve("staff", STAFF_PORT), serve("admin", ADMIN_PORT)],
});
