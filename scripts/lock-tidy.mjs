#!/usr/bin/env node
// Drops the "funding" links npm copies into package-lock.json. They are donation pages of
// third-party authors, not install data (npm ci never reads them), and the org's leak scan
// reads every host name in the repo. Run after any `npm install`; CI fails if they come back.
import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../package-lock.json", import.meta.url);
const lock = JSON.parse(readFileSync(file, "utf8"));
let dropped = 0;
for (const pkg of Object.values(lock.packages ?? {})) {
  if (pkg && typeof pkg === "object" && "funding" in pkg) {
    delete pkg.funding;
    dropped++;
  }
}
if (process.argv.includes("--check")) {
  if (dropped) {
    console.error(`package-lock.json has ${dropped} funding entries; run: node scripts/lock-tidy.mjs`);
    process.exit(1);
  }
} else {
  writeFileSync(file, `${JSON.stringify(lock, null, 2)}\n`);
  console.log(`lock-tidy: dropped ${dropped} funding entries`);
}
