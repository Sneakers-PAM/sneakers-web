import { mockPackageConfig } from "@sneakers-web/vite-config";
import path from "node:path";
import { defineConfig } from "vitest/config";

// Route tests run the real loaders and actions against the mock gateway, the same fake the
// mock build uses.
const base = mockPackageConfig(import.meta.dirname);

export default defineConfig({
  ...base,
  resolve: {
    alias: { "@": path.join(import.meta.dirname, "app"), ...base.resolve?.alias },
  },
});
