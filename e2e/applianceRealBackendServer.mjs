// Serves the built appliance admin (the live build, not the mock) the way sneakers-osadmin
// serves it on a real box today: osadmin's security headers (SecurityHeaders in
// sneakers-appliance internal/osadmin/server.go), files from build/client with page routes
// falling back to index.html, and a Connect API shaped like the real box's current state --
// sparse, mostly-empty replies from a freshly provisioned single-owner box, and TlsService,
// McpService, BackupService and ModulesService answering "unimplemented" the way
// osadminv1connect.Unimplemented*ServiceHandler does (server.go registers them with no
// implementation behind them). SignIn takes any name, password and code, so the suite signs in
// through the form.
import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";

import { OSADMIN_CSP } from "./applianceCsp.ts";

const client = path.resolve(
  import.meta.dirname,
  "../apps/appliance-admin",
  process.env.APP_BUILD_DIR ?? "build",
  "client",
);
const port = Number(process.env.PORT ?? 4180);
const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
};

const NOT_AVAILABLE = { code: "unimplemented", message: "Not available in this release" };
const SESSION = {
  admin: "owner",
  csrfToken: "test-csrf",
  role: "ROLE_OWNER",
  rootOperator: true,
  signedIn: new Date().toISOString(),
};

const ok = () => ({});

// Every method of a wholesale-unimplemented service (Tls, Mcp, Backup, Modules) answers the
// same refusal, matching server.go's NewXServiceHandler(UnimplementedXServiceHandler{}).
const unimplemented = () => {
  throw NOT_AVAILABLE;
};

const api = {
  "/sneakers.appliance.osadmin.v1.AccessService/ListAdmins": () => ({
    admins: [
      {
        createdBy: "console",
        keys: [{ fingerprint: "SHA256:ownerkey", type: "ssh-ed25519" }],
        name: "owner",
        role: "ROLE_OWNER",
        uid: 1000,
      },
    ],
    hostKeys: [{ fingerprint: "SHA256:hostkey", type: "ssh-ed25519" }],
  }),
  "/sneakers.appliance.osadmin.v1.AuditService/ListEvents": () => ({
    chainOk: true,
    events: [
      {
        action: "signin.approve",
        actor: "owner",
        detail: {},
        keyFingerprint: "SHA256:ownerkey",
        outcome: "ok",
        sourceAddress: "192.0.2.10",
        target: "owner",
      },
    ],
  }),
  "/sneakers.appliance.osadmin.v1.BackupService/GetBackups": unimplemented,
  "/sneakers.appliance.osadmin.v1.BackupService/Restore": unimplemented,
  "/sneakers.appliance.osadmin.v1.BackupService/RunBackup": unimplemented,
  "/sneakers.appliance.osadmin.v1.BackupService/SetBackupPolicy": unimplemented,
  "/sneakers.appliance.osadmin.v1.ElevationService/ListElevations": () => ({}),
  "/sneakers.appliance.osadmin.v1.McpService/GetMcp": unimplemented,
  "/sneakers.appliance.osadmin.v1.McpService/SetMcp": unimplemented,
  "/sneakers.appliance.osadmin.v1.ModulesService/AddModule": unimplemented,
  "/sneakers.appliance.osadmin.v1.ModulesService/ListModules": unimplemented,
  "/sneakers.appliance.osadmin.v1.NetworkService/GetNetwork": () => ({
    managementAddresses: ["192.0.2.10"],
    ntpOffsetMs: "4",
    ntpSynced: true,
    pending: false,
    settings: {
      addresses: [{ address: "192.0.2.10", family: "ipv4", mode: "static", prefix: 24 }],
      allowList: ["192.0.2.0/24"],
      dns: ["192.0.2.1"],
      hostname: "appliance01",
      managementInterface: "eth0",
      ntp: ["192.0.2.1"],
    },
  }),
  "/sneakers.appliance.osadmin.v1.PowerService/GetPower": () => ({
    factoryResetAvailable: false,
    factoryResetUnavailableReason:
      "This box has a single admin, so there is no quorum and no factory reset. Delete and re-create, or re-flash, the box instead.",
    sessions: [{ admin: "owner", signedIn: SESSION.signedIn, sourceAddress: "192.0.2.10" }],
  }),
  "/sneakers.appliance.osadmin.v1.SetupService/GetSetup": () => ({
    adminCount: 1,
    done: true,
    escrowFile: "",
    maxRecoveryKeys: 5,
    productSetupUrl: "",
    singleAdminAcknowledged: true,
    singleAdminWarning: true,
  }),
  "/sneakers.appliance.osadmin.v1.SignInService/GetSession": () => ({ session: SESSION }),
  "/sneakers.appliance.osadmin.v1.SignInService/SignIn": () => ({ session: SESSION }),
  "/sneakers.appliance.osadmin.v1.SignInService/SignOut": ok,
  // A box that's never had an update event leaves history out of the reply entirely (an empty
  // repeated field isn't sent); this is the exact shape that crashed Updates (issue #201).
  "/sneakers.appliance.osadmin.v1.StatusService/GetStatus": () => ({
    channel: "stable",
    custodyMode: "tpm",
    hostname: "appliance01",
    managementAddresses: ["192.0.2.10"],
    ntpSynced: true,
    phase: "normal",
    protection: "PROTECTION_FULL",
    protectionReason: "",
    runningVersion: "0.1.0",
    stagedVersion: "",
    tlsFingerprint: "aa:bb:cc",
    tlsSelfSigned: true,
    version: "0.1.0",
  }),
  "/sneakers.appliance.osadmin.v1.TlsService/CreateCsr": unimplemented,
  "/sneakers.appliance.osadmin.v1.TlsService/GetTls": unimplemented,
  "/sneakers.appliance.osadmin.v1.TlsService/SetAdminCertificate": unimplemented,
  "/sneakers.appliance.osadmin.v1.TlsService/UploadCertificate": unimplemented,
  "/sneakers.appliance.osadmin.v1.UpgradeService/GetUpgrades": () => ({
    airGapped: true,
    failedVersion: "",
    policy: { mirrorUrl: "", mode: "manual", windowMinutes: 120, windowStart: "02:00" },
    runningVersion: "0.1.0",
    stagedVersion: "",
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
    if (!answer) {
      json(response, 501, { code: "unimplemented", message: "not in this test server" });
      return;
    }
    try {
      json(response, 200, answer());
    } catch (error) {
      json(response, 501, error ?? NOT_AVAILABLE);
    }
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
