#!/usr/bin/env node
// Every built app serves its icons and one hashed stylesheet. Run after npm run build.
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
let failed = false;
for (const app of readdirSync(path.join(root, "apps"))) {
  const client = path.join(root, "apps", app, "build", "client");
  if (!existsSync(client)) continue;
  const missing = ["favicon.svg", "app-icon.svg"].filter((f) => !existsSync(path.join(client, f)));
  if (!readdirSync(path.join(client, "assets")).some((f) => f.endsWith(".css")))
    missing.push("assets/*.css");
  for (const m of missing) {
    console.error(`apps/${app}/build/client is missing ${m}`);
    failed = true;
  }
}
if (failed) process.exit(1);
console.log("check:assets: icons and stylesheet present");
