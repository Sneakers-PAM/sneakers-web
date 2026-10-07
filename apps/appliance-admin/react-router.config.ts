import type { Config } from "@react-router/dev/config";

import { isMockRun } from "@sneakers-web/vite-config";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { externalizeInlineScripts } from "./app/csp/inline.ts";

export default {
  appDirectory: "app",
  basename: "/",
  // Mock builds go to their own folder locally so they never overwrite a live one; the box's
  // image build names it, because osadmin finds its assets by this path.
  buildDirectory: process.env.APP_BUILD_DIR ?? (isMockRun() ? "build-mock" : "build"),
  // osadmin's CSP is `default-src 'self'`, so the prerendered shell's inline scripts move to
  // files (app/csp/inline.ts); `npm run check:csp` proves nothing inline is left.
  async buildEnd({ viteConfig }) {
    const client = viteConfig.build.outDir;
    const index = path.join(client, "index.html");
    const { files, html } = externalizeInlineScripts(
      await readFile(index, "utf8"),
      viteConfig.base,
    );
    await mkdir(path.join(client, "assets"), { recursive: true });
    await Promise.all(files.map((f) => writeFile(path.join(client, f.fileName), f.content)));
    await writeFile(index, html);
  },
  // A static SPA: no Node server. osadmin serves the prerendered shell and the client bundle
  // and the browser talks to its Connect API directly.
  ssr: false,
} satisfies Config;
