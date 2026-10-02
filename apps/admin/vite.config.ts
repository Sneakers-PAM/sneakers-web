import { appConfig } from "@sneakers-web/vite-config";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
  ...appConfig({ base: "/admin/", directory: import.meta.dirname, mode, port: 5177 }),
}));
