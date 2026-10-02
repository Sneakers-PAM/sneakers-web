import { appConfig, testConfig } from "@sneakers-web/vite-config";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
  ...appConfig({ base: "/", directory: import.meta.dirname, mode, port: 5176 }),
  test: testConfig(import.meta.dirname),
}));
