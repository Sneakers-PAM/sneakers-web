import { mockPackageConfig } from "@sneakers-web/vite-config";
import { defineConfig } from "vitest/config";

// These tests run the server code against the mock gateway, the same fake the mock builds use.
export default defineConfig(mockPackageConfig(import.meta.dirname));
