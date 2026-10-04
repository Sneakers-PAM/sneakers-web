#!/usr/bin/env node
// Proves no mock code shipped: every live build (apps/*/build) must be free of the mock
// gateway's marker and its session cookie, and every mock build (apps/*/build-mock) must carry
// the marker, so the check can't pass by looking at the wrong folder. Run after both builds.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const marker = /export const MOCK_MARKER = "([^"]+)"/.exec(
  readFileSync(path.join(root, "packages/mock-gateway/src/marker.ts"), "utf8"),
)?.[1];
if (!marker) throw new Error("MOCK_MARKER not found in packages/mock-gateway/src/marker.ts");
// The dev quick login's intent and label prove it never reaches a live build either.
const tells = [
  marker,
  "mock_sneakers_sid",
  "mock-gateway.example.invalid",
  "mock-quick-login",
  "Dev quick login",
];

const files = (directory) =>
  readdirSync(directory).flatMap((name) => {
    const full = path.join(directory, name);
    return statSync(full).isDirectory()
      ? files(full)
      : /\.(css|html|js|mjs)$/.test(name)
        ? [full]
        : [];
  });
const hits = (directory) =>
  files(directory).filter((f) => tells.some((t) => readFileSync(f, "utf8").includes(t)));

let failed = false;
let live = 0;
for (const app of readdirSync(path.join(root, "apps"))) {
  const build = path.join(root, "apps", app, "build");
  const mock = path.join(root, "apps", app, "build-mock");
  if (existsSync(build)) {
    live++;
    for (const f of hits(build)) {
      console.error(`mock code in a live build: ${path.relative(root, f)}`);
      failed = true;
    }
  }
  if (existsSync(mock) && hits(mock).length === 0) {
    console.error(
      `apps/${app}/build-mock has no mock marker; the check is looking at the wrong thing`,
    );
    failed = true;
  }
}
if (live === 0) {
  console.error("no live builds found; run npm run build first");
  failed = true;
}
if (failed) process.exit(1);
console.log(`check:no-mock: ${live} live builds, no mock code`);
