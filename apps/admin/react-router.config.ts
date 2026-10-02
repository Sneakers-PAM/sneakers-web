import type { Config } from "@react-router/dev/config";

import { isMockRun } from "@sneakers-web/vite-config";

export default {
  appDirectory: "app",
  basename: "/admin/",
  // Mock builds go to their own folder locally so they never overwrite a live one; the image
  // build names it, because the server finds its assets by this path.
  buildDirectory: process.env.APP_BUILD_DIR ?? (isMockRun() ? "build-mock" : "build"),
  ssr: true,
} satisfies Config;
