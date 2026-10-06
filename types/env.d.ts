/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * "true" in a live build that carries the dev quick login (the dev server, or a build with
   * SNEAKERS_DEV_QUICK_LOGIN_BUILD=true), "false" otherwise. Set at build time only.
   */
  readonly SNEAKERS_DEV_QUICK_LOGIN_BUILD: "false" | "true";
  /** "true" in a build made with `--mode mock`, "false" otherwise. Set at build time only. */
  readonly SNEAKERS_MOCK: "false" | "true";
}

/** The release version, from the root package.json at build time. */
declare const __APP_VERSION__: string;
/** The commit the app was built from (APP_COMMIT at build time), or "unknown". */
declare const __APP_COMMIT__: string;
