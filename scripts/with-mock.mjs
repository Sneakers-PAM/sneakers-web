#!/usr/bin/env node
// Runs a command against a standalone mock server: node scripts/with-mock.mjs <port> -- <command>.
// Uses the server already on that port, or starts one for as long as the command runs.
// MOCK_FRESH_INSTALL=1 reaches the server, so it starts on first-run setup.
import { spawn } from "node:child_process";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const [port, separator, command, ...arguments_] = process.argv.slice(2);
if (!/^\d+$/.test(port ?? "") || separator !== "--" || !command) {
  console.error("usage: with-mock.mjs <port> -- <command>");
  process.exit(2);
}

const gatewayUrl = `http://127.0.0.1:${port}`;
const answering = () =>
  fetch(`${gatewayUrl}/livez`).then(
    (answer) => answer.ok,
    () => false,
  );

let server;
if (!(await answering())) {
  server = spawn(
    process.execPath,
    [
      path.join(root, "node_modules/@sneakers-pam/mock-server/bin/sneakers-mock-server.mjs"),
      "--port",
      port,
    ],
    {
      env: { ...process.env, MOCK_SESSION_COOKIE: "mock_sneakers_sid" },
      stdio: ["ignore", "inherit", "inherit"],
    },
  );
  server.on("exit", (code) => {
    console.error(`mock server exited (${code})`);
    process.exit(1);
  });
  while (!(await answering())) await new Promise((wait) => setTimeout(wait, 100));
}

const child = spawn(command, arguments_, {
  env: { ...process.env, MOCK_GATEWAY_URL: gatewayUrl },
  stdio: "inherit",
});
const stop = () => {
  server?.removeAllListeners("exit");
  server?.kill();
};
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", (code, signal) => {
  stop();
  process.exit(code ?? (signal ? 1 : 0));
});
