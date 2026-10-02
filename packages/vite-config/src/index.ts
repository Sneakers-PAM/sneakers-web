import type { Connect, Plugin, PluginOption, UserConfig } from "vite";

import { mockNavigationPlugin } from "@sneakers-web/mock-gateway/vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { msw } from "msw/vite";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const package_ = (p: string) => path.join(root, "packages", p, "src");

/** The mode that builds an app against the mock gateway. Any other mode is live. */
export const MOCK_MODE = "mock";

export interface EdgeChoice {
  mock: boolean;
  /** The module every app imports as `@sneakers-web/edge`. */
  module: string;
}

/**
 * Pick the network edge for a build. The choice is made here, at build time, from the
 * Vite mode alone: `--mode mock` swaps in the mock gateway, everything else is live. A
 * SNEAKERS_MOCK variable on a live build is refused so a production build can't be
 * talked into mock mode.
 */
export const chooseEdge = (mode: string, env: NodeJS.ProcessEnv = process.env): EdgeChoice => {
  const mock = mode === MOCK_MODE;
  if (
    !mock &&
    env.SNEAKERS_MOCK !== undefined &&
    env.SNEAKERS_MOCK !== "" &&
    env.SNEAKERS_MOCK !== "false"
  ) {
    throw new Error(
      `SNEAKERS_MOCK=${env.SNEAKERS_MOCK} is set for a "${mode}" build. Mock mode comes only from --mode mock.`,
    );
  }
  return {
    mock,
    module: mock
      ? path.join(package_("mock-gateway"), "edge.ts")
      : path.join(package_("api-client"), "edge/live.ts"),
  };
};

/** Aliases shared by every app and package: the package-internal prefixes and the edge. */
export const sharedAliases = (edgeModule: string): Record<string, string> => {
  return {
    "@sneakers-web/edge": edgeModule,
    "#api": package_("api-client"),
    "#mock": package_("mock-gateway"),
    "#shell": package_("shell"),
    "#ui": package_("ui"),
  };
};

const version = (
  JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as { version: string }
).version;

export interface AppOptions {
  /** The path the app is served under, e.g. "/" or "/admin/". */
  base: string;
  /** The app folder, e.g. apps/staff (pass import.meta.dirname). */
  dir: string;
  extraPlugins?: PluginOption[];
  mode: string;
  port: number;
}

/** The Vite (and Vitest) config every app uses. */
export const appConfig = ({ base, dir, extraPlugins = [], mode, port }: AppOptions): UserConfig => {
  const edge = chooseEdge(mode);
  const plugins: PluginOption[] = [react(), tailwindcss(), devConfigPlugin(), ...extraPlugins];
  if (edge.mock) plugins.push(msw({ mode: "worker-only" }), mockNavigationPlugin());
  return {
    base,
    build: {
      emptyOutDir: true,
      outDir: edge.mock ? "dist-mock" : "dist",
      sourcemap: false,
    },
    define: {
      __APP_VERSION__: JSON.stringify(version),
      "import.meta.env.SNEAKERS_MOCK": JSON.stringify(edge.mock ? "true" : "false"),
    },
    plugins,
    preview: { port, strictPort: true },
    resolve: {
      alias: { "@": path.join(dir, "src"), ...sharedAliases(edge.module) },
    },
    server: {
      port,
      proxy: edge.mock
        ? undefined
        : Object.fromEntries(
            ["/graphql", "/auth", "/setup", "/oauth2", "/health"].map((p) => [
              p,
              {
                target: process.env.SNEAKERS_GATEWAY_URL ?? "http://localhost:9100",
                ws: p === "/graphql",
              },
            ]),
          ),
      strictPort: true,
    },
  };
};

/**
 * Serves /config.js on the dev and preview servers. Deployed apps get theirs from the
 * server (written from the deployment's settings); a build never contains one.
 */
export const devConfigPlugin = (): Plugin => {
  const body = `window.__APP_CONFIG__ = ${JSON.stringify({
    adminUrl: "/admin/",
    appEnv: "dev",
    logLevel: process.env.LOG_LEVEL ?? "trace",
    sso: true,
    staffUrl: "/",
  })};\n`;
  const handle: Connect.NextHandleFunction = (request, res, next) => {
    if (!(request.url ?? "").split("?", 1)[0]?.endsWith("/config.js")) return next();
    res.setHeader("Content-Type", "text/javascript; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(body);
  };
  return {
    configurePreviewServer(server) {
      server.middlewares.use(handle);
    },
    configureServer(server) {
      server.middlewares.use(handle);
    },
    name: "sneakers-dev-config",
  };
};

/** The Vitest config for a library package (no app entry). */
export const packageConfig = (
  dir: string,
): { test: ReturnType<typeof testConfig> } & UserConfig => {
  const edge = chooseEdge("test");
  return {
    define: {
      __APP_VERSION__: JSON.stringify(version),
      "import.meta.env.SNEAKERS_MOCK": JSON.stringify("false"),
    },
    plugins: [react()],
    resolve: { alias: sharedAliases(edge.module) },
    test: testConfig(dir),
  };
};

/** Vitest settings for a package or an app: jsdom, globals and the shared setup file. */
export const testConfig = (dir: string) => {
  return {
    css: false,
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.{ts,tsx}"],
    root: dir,
    setupFiles: [path.join(here, "setupTests.ts")],
  };
};
