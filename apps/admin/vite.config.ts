import { appConfig, testConfig } from "@sneakers-web/vite-config";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
  ...appConfig({ base: "/admin/", dir: import.meta.dirname, mode, port: 5177 }),
  test: testConfig(import.meta.dirname),
}));
