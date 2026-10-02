import { appConfig, MOCK_MODE, testConfig } from "@sneakers-web/vite-config";
import { defineConfig } from "vite";

// Tests run the staff routes against the mock gateway, so under Vitest the mock edge is used.
export default defineConfig(({ mode }) => ({
  ...appConfig({
    base: "/",
    directory: import.meta.dirname,
    mode: process.env.VITEST ? MOCK_MODE : mode,
    port: 5176,
  }),
  test: testConfig(import.meta.dirname),
}));
