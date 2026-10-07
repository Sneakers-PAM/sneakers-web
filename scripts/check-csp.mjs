#!/usr/bin/env node
// The appliance admin runs under sneakers-osadmin's `Content-Security-Policy: default-src
// 'self'`: fail if a built page (live or mock) carries an inline script or style, an event
// handler attribute, a javascript: URL or a resource from another origin. Run after the builds.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { findCspViolations } from "../apps/appliance-admin/app/csp/inline.ts";

const app = path.resolve(import.meta.dirname, "../apps/appliance-admin");
const pages = (directory) =>
  readdirSync(directory, { recursive: true })
    .filter((f) => f.endsWith(".html"))
    .map((f) => path.join(directory, f));

let checked = 0;
let failed = false;
for (const build of ["build", "build-mock"]) {
  const client = path.join(app, build, "client");
  if (!existsSync(client)) continue;
  for (const page of pages(client)) {
    checked++;
    for (const v of findCspViolations(readFileSync(page, "utf8"))) {
      console.error(`${path.relative(app, page)}: ${v}`);
      failed = true;
    }
  }
}
if (checked === 0) {
  console.error("check:csp: no appliance admin build to check; run npm run build first");
  process.exit(1);
}
if (failed) process.exit(1);
console.log(`check:csp: ${checked} appliance admin page(s) need nothing beyond default-src 'self'`);
