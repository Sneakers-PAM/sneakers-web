import { testConfig } from "@sneakers-web/vite-config";
import path from "node:path";
import { defineConfig } from "vitest/config";

const root = path.resolve(import.meta.dirname, "../..");

// Route tests always run against the mock transport, the same fake the mock build uses. The
// mock flag is stubbed in app/test/setup.ts, not defined here: Vitest copies import.meta.env
// defines into process.env for every project in a run, which would put the shell's live-build
// tests in mock mode.
export default defineConfig({
  define: {
    __APP_COMMIT__: JSON.stringify("test"),
    __APP_VERSION__: JSON.stringify("test"),
  },
  resolve: {
    alias: {
      "@": path.join(import.meta.dirname, "app"),
      "@sneakers-web/edge": path.join(import.meta.dirname, "app/mock/edge.mock.ts"),
      "#api": path.join(root, "packages/api-client/src"),
      "#mock": path.join(root, "packages/mock-gateway/src"),
      "#shell": path.join(root, "packages/shell/src"),
      "#ui": path.join(root, "packages/ui/src"),
    },
  },
  test: {
    ...testConfig(import.meta.dirname),
    setupFiles: [
      ...testConfig(import.meta.dirname).setupFiles,
      path.join(import.meta.dirname, "app/test/setup.ts"),
    ],
  },
});
