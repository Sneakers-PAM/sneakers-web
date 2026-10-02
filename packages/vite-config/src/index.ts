import type { PluginOption, UserConfig } from "vite";

import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const source = (name: string) => path.join(root, "packages", name, "src");

/** The Vite mode that builds an app against the mock gateway. Any other mode is live. */
export const MOCK_MODE = "mock";

/** True when this process is a `--mode mock` build or dev server. */
export const isMockRun = (argv: string[] = process.argv): boolean => {
  const index = argv.indexOf("--mode");
  return index !== -1 && argv[index + 1] === MOCK_MODE;
};

export interface EdgeChoice {
  mock: boolean;
  /** The server module every app imports as `@sneakers-web/edge.server`. */
  module: string;
}

/**
 * Pick the network edge for a build. The choice is made here, at build time, from the Vite
 * mode alone: `--mode mock` swaps in the mock gateway, everything else is live. A
 * SNEAKERS_MOCK variable on a live build is refused, so a production build can't be talked
 * into mock mode.
 */
export const chooseEdge = (
  mode: string,
  environment: NodeJS.ProcessEnv = process.env,
): EdgeChoice => {
  const mock = mode === MOCK_MODE;
  const flag = environment.SNEAKERS_MOCK;
  if (!mock && flag !== undefined && flag !== "" && flag !== "false") {
    throw new Error(
      `SNEAKERS_MOCK=${flag} is set for a "${mode}" build. Mock mode comes only from --mode mock.`,
    );
  }
  return {
    mock,
    module: mock
      ? path.join(source("mock-gateway"), "edge.server.ts")
      : path.join(source("api-client"), "edge/live.server.ts"),
  };
};

/** Aliases shared by every app and package: the package-internal prefixes and the edge. */
export const sharedAliases = (edgeModule: string): Record<string, string> => ({
  "@sneakers-web/edge.server": edgeModule,
  "#api": source("api-client"),
  "#mock": source("mock-gateway"),
  "#shell": source("shell"),
  "#ui": source("ui"),
});

const version = (
  JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as { version: string }
).version;

const defines = (mock: boolean) => ({
  __APP_VERSION__: JSON.stringify(version),
  "import.meta.env.SNEAKERS_MOCK": JSON.stringify(mock ? "true" : "false"),
});

export interface AppOptions {
  /** The path the app is served under, e.g. "/" or "/admin/". */
  base: string;
  /** The app folder (pass import.meta.dirname). */
  directory: string;
  mode: string;
  port: number;
}

/** Gateway routes the browser itself goes to (single sign-on is a full-page redirect). */
const BROWSER_GATEWAY_ROUTES = ["/auth/sso"];

/**
 * The Vite config every app uses: React Router in framework mode (server rendering), the
 * Laces Tailwind theme, the shared aliases and the edge for this build. Under Vitest it
 * swaps the React Router plugin for plain React, which is all component tests need.
 */
export const appConfig = ({ base, directory, mode, port }: AppOptions): UserConfig => {
  const testing = !!process.env.VITEST;
  // Vitest copies import.meta.env defines into process.env for every project in a run, so
  // under test the mock flag is neither defined nor checked; the edge alias decides.
  const edge = chooseEdge(mode, testing ? {} : process.env);
  const plugins: PluginOption[] = [tailwindcss(), testing ? react() : reactRouter()];
  return {
    base,
    build: { sourcemap: false },
    define: testing ? { __APP_VERSION__: JSON.stringify(version) } : defines(edge.mock),
    plugins,
    preview: { port, strictPort: true },
    resolve: { alias: { "@": path.join(directory, "app"), ...sharedAliases(edge.module) } },
    server: {
      port,
      proxy: edge.mock
        ? undefined
        : Object.fromEntries(
            BROWSER_GATEWAY_ROUTES.map((p) => [
              p,
              { target: process.env.GATEWAY_URL ?? "http://localhost:9100" },
            ]),
          ),
      strictPort: true,
    },
    ssr: { noExternal: [/^@sneakers-web\//] },
  };
};

/** Vitest settings for a package or an app: jsdom, globals and the shared setup file. */
export const testConfig = (directory: string) => ({
  css: false,
  environment: "jsdom",
  globals: true,
  include: ["{app,src}/**/*.test.{ts,tsx}"],
  root: directory,
  setupFiles: [path.join(here, "setupTests.ts")],
});

/** The Vitest config for a library package (no app entry). */
export const packageConfig = (
  directory: string,
): { test: ReturnType<typeof testConfig> } & UserConfig => ({
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [react()],
  resolve: { alias: sharedAliases(chooseEdge("test", {}).module) },
  test: testConfig(directory),
});

/** The Vitest config for tests that run against the mock gateway (the mock package's own). */
export const mockPackageConfig = (
  directory: string,
): { test: ReturnType<typeof testConfig> } & UserConfig => ({
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [react()],
  resolve: { alias: sharedAliases(chooseEdge(MOCK_MODE, {}).module) },
  test: testConfig(directory),
});
