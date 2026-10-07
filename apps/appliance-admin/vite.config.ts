import { reactRouter } from "@react-router/dev/vite";
import { appCommit } from "@sneakers-web/vite-config";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync } from "node:fs";
import path from "node:path";
import { defineConfig, type UserConfig } from "vite";

const here = import.meta.dirname;
const root = path.resolve(here, "../..");
const MOCK_MODE = "mock";

const version =
  process.env.APP_VERSION ||
  (JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as { version: string })
    .version;
const commit = appCommit();

export default defineConfig(({ mode }): UserConfig => {
  const mock = mode === MOCK_MODE;
  return {
    base: "/",
    build: { sourcemap: false },
    define: {
      __APP_COMMIT__: JSON.stringify(commit),
      __APP_VERSION__: JSON.stringify(version),
      "import.meta.env.SNEAKERS_MOCK": JSON.stringify(mock ? "true" : "false"),
    },
    plugins: [tailwindcss(), reactRouter()],
    preview: { port: 5180, strictPort: true },
    resolve: {
      alias: {
        "@": path.join(here, "app"),
        "@sneakers-web/edge": mock
          ? path.join(here, "app/mock/edge.mock.ts")
          : path.join(here, "app/lib/edge.live.ts"),
        "#api": path.join(root, "packages/api-client/src"),
        "#mock": path.join(root, "packages/mock-gateway/src"),
        "#shell": path.join(root, "packages/shell/src"),
        "#ui": path.join(root, "packages/ui/src"),
      },
    },
    server: { port: 5180, strictPort: true },
  };
});
