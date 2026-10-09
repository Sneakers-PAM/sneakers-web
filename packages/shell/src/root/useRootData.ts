import { DEFAULT_DISPLAY } from "@sneakers-web/ui";
import { useRouteLoaderData } from "react-router";

import type { RootData } from "#shell/server/root.server";

const FALLBACK: RootData = {
  banner: null,
  boxPoller: false,
  config: {
    adminUrl: "/admin/",
    appEnv: "prod",
    logLevel: "error",
    sso: true,
    staffUrl: "/",
    version: "",
  },
  developmentUiIssueCopy: false,
  display: DEFAULT_DISPLAY,
  needsSetup: false,
  storagePrefix: "",
};

/** The root loader's data (settings, display choice, banner). Error screens get safe defaults. */
export const useRootData = (): RootData => useRouteLoaderData<RootData>("root") ?? FALLBACK;
