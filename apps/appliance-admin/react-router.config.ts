import type { Config } from "@react-router/dev/config";

import { isMockRun } from "@sneakers-web/vite-config";

export default {
  appDirectory: "app",
  basename: "/",
  // Mock builds go to their own folder locally so they never overwrite a live one; the box's
  // image build names it, because osadmin finds its assets by this path.
  buildDirectory: process.env.APP_BUILD_DIR ?? (isMockRun() ? "build-mock" : "build"),
  // A static SPA: no Node server. osadmin serves the prerendered shell and the client bundle
  // and the browser talks to its Connect API directly.
  ssr: false,
} satisfies Config;
