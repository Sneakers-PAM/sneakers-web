#!/usr/bin/env node
// Proves no mock code shipped: every live build (apps/*/build) must be free of the mock
// gateway's marker and its session cookie, and every mock build (apps/*/build-mock) must carry
// the marker, so the check can't pass by looking at the wrong folder. Run after both builds.
// It also proves a release can't turn on the dev quick login or the dev-only "Copy for UI
// issue" button: the live build carries none of their code or variable names, and the
// Dockerfile's DEV_QUICK_LOGIN and DEV_UI_ISSUE_COPY build arguments are off.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const marker = /export const MOCK_MARKER = "([^"]+)"/.exec(
  readFileSync(path.join(root, "packages/mock-gateway/src/marker.ts"), "utf8"),
)?.[1];
if (!marker) throw new Error("MOCK_MARKER not found in packages/mock-gateway/src/marker.ts");
// The dev quick login's intents, label and server variables prove it never reaches a live
// build either, so setting SNEAKERS_DEV_QUICK_LOGIN on a release image does nothing. Same for
// the dev-only "Copy for UI issue" button and SNEAKERS_DEV_UI_ISSUE_COPY.
// The UI issue item renders this marker as a data attribute. A live build must not carry it,
// and the mounted item must still reference it, so the tell can't go stale and pass by default.
const issueCopyMarker = /export const ISSUE_COPY_MARKER = "([^"]+)"/.exec(
  readFileSync(path.join(root, "packages/shell/src/issueCopy/IssueCopyMenuItem.tsx"), "utf8"),
);
if (!issueCopyMarker || !issueCopyMarker.input.includes("data-issue-copy={ISSUE_COPY_MARKER}")) {
  throw new Error(
    "IssueCopyMenuItem must define ISSUE_COPY_MARKER and render it as data-issue-copy",
  );
}
const tells = [
  marker,
  issueCopyMarker[1],
  "mock_sneakers_sid",
  "mock-gateway.example.invalid",
  "mock-quick-login",
  "dev-quick-login",
  "Dev quick login",
  "SNEAKERS_DEV_QUICK_LOGIN",
  "Copy for UI issue",
  "SNEAKERS_DEV_UI_ISSUE_COPY",
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

const dockerfile = readFileSync(path.join(root, "Dockerfile"), "utf8");
const allowance = [...dockerfile.matchAll(/^ARG DEV_QUICK_LOGIN(?:=(\S*))?\s*$/gm)];
if (allowance.length === 0 || allowance.some(([, value]) => value !== "false")) {
  console.error("Dockerfile: every ARG DEV_QUICK_LOGIN must default to false");
  failed = true;
}
const issueCopyAllowance = [...dockerfile.matchAll(/^ARG DEV_UI_ISSUE_COPY(?:=(\S*))?\s*$/gm)];
if (issueCopyAllowance.length === 0 || issueCopyAllowance.some(([, value]) => value !== "false")) {
  console.error("Dockerfile: every ARG DEV_UI_ISSUE_COPY must default to false");
  failed = true;
}

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
console.log(`check:no-mock: ${live} live builds, no mock code, dev quick login or UI issue copy`);
