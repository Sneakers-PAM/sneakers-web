import { MOCK_MARKER } from "@sneakers-web/mock-gateway";

import type { Edge } from "@/lib/osadmin/edgeTypes";
import type {
  Admin,
  BackupPolicy,
  ElevationPolicy,
  FactoryReset,
  NetdSettings,
  Session,
} from "@/lib/osadmin/types";

import { OsadminError } from "@/lib/osadmin/errors";
import * as world from "@/mock/world";

/** The banner every screen shows while the app runs against the mock transport. */
export const MOCK_BANNER = `MOCK DATA, not a real box (${MOCK_MARKER})`;

let pollAttempts = new Map<string, number>();
let networkPending: { settings: NetdSettings; token: string } | null = null;
const modules = structuredClone(world.MODULES);
const recoveryKeys = structuredClone(world.RECOVERY_KEYS);
const admins = structuredClone(world.ADMINS);
const elevations = structuredClone(world.ELEVATIONS);
const auditEvents = structuredClone(world.AUDIT_EVENTS);
let quorum = structuredClone(world.QUORUM);
let elevationPolicy = structuredClone(world.ELEVATION_POLICY);
let networkSettings = structuredClone(world.NETWORK_SETTINGS);
let mcpEnabled = true;
let machineApiEnabled = false;
let backupPolicy = structuredClone(world.BACKUP_POLICY);
const backupSets = structuredClone(world.BACKUP_SETS);
let factoryReset: FactoryReset | undefined;
let singleAdminAcknowledged = false;
let setupDone = true;
let secureBootOn = true;

const unimplemented = (message: string) => new OsadminError("unimplemented", message);
const notFound = (message: string) => new OsadminError("not_found", message);

const findAdmin = (name: string) => admins.find((a) => a.name === name);

const route = async (service: string, method: string, body: Record<string, unknown>) => {
  switch (`${service}/${method}`) {
    case "AccessService/AddAdmin": {
      const admin = {
        created: new Date().toISOString(),
        createdBy: "alice",
        keys: body.publicKey
          ? [
              {
                added: new Date().toISOString(),
                addedBy: "alice",
                comment: "",
                fingerprint: `SHA256:new${admins.length}`,
                type: "ssh-ed25519",
                via: "osadmin",
              },
            ]
          : [],
        name: body.name as string,
        role: (body.role as Admin["role"]) || "ROLE_ADMIN",
        uid: 20_000 + admins.length,
      };
      admins.push(admin);
      return { admin };
    }
    case "AccessService/AddKey": {
      const admin = findAdmin(body.admin as string);
      const key = {
        added: new Date().toISOString(),
        addedBy: admin?.name ?? "",
        comment: "",
        fingerprint: `SHA256:newkey${Date.now()}`,
        type: "ssh-ed25519",
        via: "osadmin",
      };
      admin?.keys.push(key);
      return { key };
    }
    case "AccessService/ListAdmins": {
      return { admins, elevationPolicy, hostKeys: world.HOST_KEYS, quorum };
    }
    case "AccessService/RemoveAdmin": {
      if (admins.length <= 1) throw new OsadminError("failed_precondition", "ACCESS_LAST_OWNER");
      const index = admins.findIndex((a) => a.name === body.name);
      if (index !== -1) admins.splice(index, 1);
      return {};
    }
    case "AccessService/RemoveKey": {
      const admin = findAdmin(body.admin as string);
      if (admin) admin.keys = admin.keys.filter((k) => k.fingerprint !== body.fingerprint);
      return {};
    }
    case "AccessService/SetElevationPolicy": {
      elevationPolicy = body.policy as ElevationPolicy;
      return {};
    }
    case "AccessService/SetQuorum": {
      quorum = {
        configured: true,
        members: body.members as string[],
        required: body.required as number,
      };
      return {};
    }
    case "AccessService/SetRole": {
      const admin = findAdmin(body.name as string);
      if (admin) admin.role = body.role as Admin["role"];
      return {};
    }
    case "AuditService/ListEvents": {
      return { chainError: "", chainOk: true, events: auditEvents, nextPageToken: "" };
    }
    case "BackupService/GetBackups": {
      return { policy: backupPolicy, sets: backupSets };
    }
    case "BackupService/Restore": {
      return {};
    }
    case "BackupService/RunBackup": {
      backupSets.unshift({
        id: `bk-${Date.now()}`,
        sizeBytes: "483200000",
        taken: new Date().toISOString(),
        target: "sftp",
      });
      return {};
    }
    case "BackupService/SetBackupPolicy": {
      backupPolicy = body.policy as BackupPolicy;
      return {};
    }
    case "ElevationService/ApproveElevation": {
      const elevation = elevations.find((item) => item.id === body.id);
      if (elevation) elevation.state = "approved";
      return {};
    }
    case "ElevationService/DenyElevation": {
      const elevation = elevations.find((item) => item.id === body.id);
      if (elevation) elevation.state = "denied";
      return {};
    }
    case "ElevationService/ListElevations": {
      return { elevations: [...elevations] };
    }
    case "ElevationService/TerminateElevation": {
      const elevation = elevations.find((item) => item.id === body.id);
      if (elevation) elevation.state = "ended";
      return {};
    }
    case "McpService/GetMcp": {
      return { machineApiEnabled, mcpEnabled, state: mcpEnabled ? "running" : "stopped" };
    }
    case "McpService/SetMcp": {
      mcpEnabled = body.mcpEnabled as boolean;
      machineApiEnabled = body.machineApiEnabled as boolean;
      return {};
    }
    case "ModulesService/AddModule": {
      modules.available.push({ active: false, name: "uploaded-module", version: "0.0.1" });
      return {};
    }
    case "ModulesService/ListModules": {
      return { available: [...modules.available], platform: modules.platform };
    }
    case "NetworkService/ConfirmNetwork": {
      if (networkPending && networkPending.token === body.token) {
        networkSettings = networkPending.settings;
        networkPending = null;
      }
      return {};
    }
    case "NetworkService/GetNetwork": {
      return {
        managementAddresses: ["192.0.2.50"],
        ntpOffsetMs: "4",
        ntpSynced: true,
        pending: !!networkPending,
        serviceAddresses: [],
        settings: networkSettings,
      };
    }
    case "NetworkService/RunChecks": {
      return {
        checks: [
          { detail: "up", name: "link", status: "ok" },
          { detail: "192.0.2.50/24", name: "address", status: "ok" },
          { detail: "192.0.2.1 reachable", name: "gateway", status: "ok" },
          { detail: "192.0.2.53 answered", name: "dns", status: "ok" },
          { detail: "offset 4ms", name: "ntp", status: "ok" },
        ],
      };
    }
    case "NetworkService/SetNetwork": {
      const token = Math.random().toString(36).slice(2);
      networkPending = { settings: body.settings as NetdSettings, token };
      return { revertAfterSeconds: 120, token };
    }
    case "PowerService/GetPower": {
      return {
        factoryReset,
        factoryResetAvailable: admins.length > 1,
        factoryResetUnavailableReason:
          admins.length > 1 ? "" : "A single-admin box can't reach a quorum.",
        sessions: [
          { admin: "alice", signedIn: new Date().toISOString(), sourceAddress: "192.0.2.10" },
        ],
      };
    }
    case "PowerService/Reboot":
    case "PowerService/Shutdown": {
      return {};
    }
    case "SetupService/AcknowledgeSingleAdmin": {
      singleAdminAcknowledged = true;
      return {};
    }
    case "SetupService/AddRecoveryKey": {
      if (recoveryKeys.length >= 3)
        throw new OsadminError("invalid_argument", "ACCESS_RECOVERY_KEY_LIMIT");
      const key = {
        fingerprint: `SHA256:mock${recoveryKeys.length}`,
        label: (body.label as string) || "",
        set: new Date().toISOString(),
        setBy: "alice",
        type: "ssh-ed25519",
      };
      recoveryKeys.push(key);
      return { recoveryKey: key };
    }
    case "SetupService/DownloadEscrow": {
      return { content: btoa("mock-escrow-ciphertext"), fileName: "escrow-20261007.age" };
    }
    case "SetupService/Finish": {
      setupDone = true;
      return { productSetupUrl: "https://appliance.example.org/setup" };
    }
    case "SetupService/GetSetup": {
      return {
        adminCount: admins.length,
        done: setupDone,
        escrowFile: recoveryKeys.length > 0 ? "escrow-20261007.age" : "",
        maxRecoveryKeys: 3,
        productSetupUrl: "https://appliance.example.org/setup",
        recoveryKeys,
        singleAdminAcknowledged,
        singleAdminWarning: admins.length === 1,
      };
    }
    case "SetupService/RemoveRecoveryKey": {
      if (recoveryKeys.length <= 1)
        throw new OsadminError("invalid_argument", "ACCESS_LAST_RECOVERY_KEY");
      const index = recoveryKeys.findIndex((k) => k.fingerprint === body.fingerprint);
      if (index !== -1) recoveryKeys.splice(index, 1);
      return {};
    }
    case "SignInService/BeginSignIn": {
      const token = Math.random().toString(36).slice(2);
      pollAttempts.set(token, 0);
      return {
        code: "ABCD-1234",
        expires: new Date(Date.now() + 5 * 60_000).toISOString(),
        pollToken: token,
        sourceAddress: "192.0.2.10",
        userAgent: "Mozilla/5.0 (mock)",
      };
    }
    case "SignInService/GetSession": {
      return { session: undefined };
    }
    case "SignInService/PollSignIn": {
      const token = body.pollToken as string;
      const attempts = (pollAttempts.get(token) ?? 0) + 1;
      pollAttempts.set(token, attempts);
      if (attempts < 2) return { state: "SIGN_IN_STATE_PENDING" };
      const admin = admins[0];
      if (!admin) throw notFound("no admin");
      return { session: world.sessionFor(admin), state: "SIGN_IN_STATE_APPROVED" };
    }
    case "SignInService/SignOut": {
      return {};
    }
    case "StatusService/GetStatus": {
      return {
        ...world.status(),
        factoryReset,
        protection: secureBootOn ? "PROTECTION_FULL" : "PROTECTION_REDUCED",
      };
    }
    case "StatusService/SetSecureBoot": {
      secureBootOn = body.on as boolean;
      return {};
    }
    case "TlsService/CreateCsr": {
      return {
        csrPem: "-----BEGIN CERTIFICATE REQUEST-----\nmock\n-----END CERTIFICATE REQUEST-----",
      };
    }
    case "TlsService/GetTls": {
      return {
        adminUsesProduct: false,
        caBundle: [],
        product: world.PRODUCT_CERT,
        source: "self-signed",
      };
    }
    case "TlsService/SetAdminCertificate": {
      return {};
    }
    case "TlsService/UploadCertificate": {
      return {};
    }
    case "PowerService/ApproveFactoryReset":
    case "PowerService/CancelFactoryReset":
    case "PowerService/StartFactoryReset": {
      throw unimplemented("factory reset is not available in this release");
    }
    default: {
      throw unimplemented(`mock transport has no ${service}/${method}`);
    }
  }
};

export const edge: Edge = {
  banner: MOCK_BANNER,
  async exportAuditLog(): Promise<Blob> {
    const lines = auditEvents.map((event) => JSON.stringify(event)).join("\n");
    return new Blob([lines], { type: "application/jsonl" });
  },
  mode: "mock" as const,
  quickLogin: {
    signIn: (adminName: string): null | Session => {
      const admin = findAdmin(adminName);
      return admin ? world.sessionFor(admin) : null;
    },
    users: () =>
      admins.map((a) => ({
        id: a.name,
        label: a.name,
        note: a.role === "ROLE_OWNER" ? "owner" : "admin",
      })),
  },
  async request<Result>(service: string, method: string, body: unknown): Promise<Result> {
    return (await route(service, method, (body as Record<string, unknown>) ?? {})) as Result;
  },
  async upload(): Promise<{ uploadId: string }> {
    return { uploadId: `upload-${Date.now()}` };
  },
};

const refill = <T>(target: T[], source: readonly T[]) => {
  target.splice(0, target.length, ...structuredClone(source));
};

/** Resets every mutable piece of the mock world, so tests don't see another test's writes. */
export const resetMockWorld = (): void => {
  pollAttempts = new Map();
  networkPending = null;
  singleAdminAcknowledged = false;
  setupDone = true;
  secureBootOn = true;
  factoryReset = undefined;
  mcpEnabled = true;
  machineApiEnabled = false;
  quorum = structuredClone(world.QUORUM);
  elevationPolicy = structuredClone(world.ELEVATION_POLICY);
  networkSettings = structuredClone(world.NETWORK_SETTINGS);
  backupPolicy = structuredClone(world.BACKUP_POLICY);
  refill(modules.available, world.MODULES.available);
  refill(recoveryKeys, world.RECOVERY_KEYS);
  refill(admins, world.ADMINS);
  refill(elevations, world.ELEVATIONS);
  refill(auditEvents, world.AUDIT_EVENTS);
  refill(backupSets, world.BACKUP_SETS);
};
