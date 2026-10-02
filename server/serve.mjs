#!/usr/bin/env node
// Starts an app server: node server/serve.mjs <path to build/server/index.js>
// It replaces react-router-serve, which can't be told to trust a proxy, so behind a
// TLS-terminating edge every form post failed React Router's origin check.
// Settings: PORT (3000), HOST, TRUST_PROXY, LOG_LEVEL, LOG_FORMAT.
import path from "node:path";
import { pathToFileURL } from "node:url";

import { createApp, createLog } from "./app.mjs";

const buildPath = process.argv[2];
if (!buildPath) {
  console.error("usage: serve.mjs <path to build/server/index.js>");
  process.exit(2);
}

const log = createLog(process.env);
const build = await import(pathToFileURL(path.resolve(buildPath)).href);
const app = createApp(build, process.env, log);
const port = Number(process.env.PORT || 3000);
const server = process.env.HOST ? app.listen(port, process.env.HOST) : app.listen(port);
server.on("listening", () =>
  log("info", "listening", { port, trustProxy: String(app.get("trust proxy")) }),
);
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => server.close());
