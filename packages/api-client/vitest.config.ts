import { packageConfig } from "@sneakers-web/vite-config";
import { defineConfig } from "vitest/config";

export default defineConfig(packageConfig(import.meta.dirname));
