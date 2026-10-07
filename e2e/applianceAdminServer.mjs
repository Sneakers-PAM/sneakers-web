// Serves the built appliance admin the way sneakers-osadmin does on :8443: the same security
// headers (SecurityHeaders in sneakers-appliance internal/osadmin/server.go), files from
// build/client with page routes falling back to index.html, and the Connect API at the same
// origin. Only the two sign-in calls answer, with a fixed pending code; everything else is a
// Connect "unimplemented", which the pages show as "Not available".
import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";

import { OSADMIN_CSP, SIGN_IN_CODE } from "./applianceCsp.ts";

const client = path.resolve(
  import.meta.dirname,
  "../apps/appliance-admin",
  process.env.APP_BUILD_DIR ?? "build",
  "client",
);
const port = Number(process.env.PORT ?? 4179);
const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
};

const api = {
  "/sneakers.appliance.osadmin.v1.SignInService/BeginSignIn": () => ({
    code: SIGN_IN_CODE,
    pollToken: "poll-token",
    sourceAddress: "192.0.2.10",
    userAgent: "the test browser",
  }),
  "/sneakers.appliance.osadmin.v1.SignInService/PollSignIn": () => ({
    state: "SIGN_IN_STATE_PENDING",
  }),
};

const json = (response, status, body) => {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
};

const fileFor = (urlPath) => {
  const name = path.join(client, path.normalize(decodeURIComponent(urlPath)));
  if (!name.startsWith(client)) return;
  try {
    return statSync(name).isFile() ? name : undefined;
  } catch {
    return;
  }
};

createServer((request, response) => {
  response.setHeader("Content-Security-Policy", OSADMIN_CSP);
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("Cache-Control", "no-store");
  const { pathname } = new URL(request.url ?? "/", "http://127.0.0.1");
  if (request.method === "POST" && pathname.startsWith("/sneakers.appliance.osadmin.v1.")) {
    const answer = api[pathname];
    request.resume();
    if (answer) json(response, 200, answer());
    else json(response, 501, { code: "unimplemented", message: "not in this test server" });
    return;
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405).end();
    return;
  }
  const file = fileFor(pathname) ?? path.join(client, "index.html");
  response.writeHead(200, {
    "Content-Type": types[path.extname(file)] ?? "application/octet-stream",
  });
  createReadStream(file).pipe(response);
}).listen(port, "127.0.0.1");
