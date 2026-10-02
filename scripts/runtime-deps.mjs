#!/usr/bin/env node
// Trims the workspace down to what one app image runs, before `npm install --omit=dev`.
// The server bundle already contains every @sneakers-web package, so the image only needs their
// third-party dependencies. npm ci installs every workspace's dependencies whatever -w says, so
// instead this keeps just the app and the packages it bundles (plus the mock gateway for a mock
// image) and drops their dev dependencies. The lockfile still pins every version.
//   node scripts/runtime-deps.mjs <staff|admin> <live|mock>
import { readFileSync, writeFileSync } from "node:fs";

const [app, edge] = process.argv.slice(2);
if (!["admin", "staff"].includes(app) || !["live", "mock"].includes(edge)) {
  console.error("usage: runtime-deps.mjs <staff|admin> <live|mock>");
  process.exit(2);
}

const workspaces = [`apps/${app}`, "packages/api-client", "packages/shell", "packages/ui"];
if (edge === "mock") workspaces.push("packages/mock-gateway");

const edit = (file, change) => {
  const json = JSON.parse(readFileSync(file, "utf8"));
  change(json);
  writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`);
};

edit("package.json", (root) => {
  root.workspaces = workspaces;
  delete root.devDependencies;
  delete root.scripts;
});
for (const workspace of workspaces) {
  edit(`${workspace}/package.json`, (json) => {
    delete json.devDependencies;
    delete json.scripts;
  });
}
console.log(`runtime workspaces for ${app} (${edge}): ${workspaces.join(", ")}`);
