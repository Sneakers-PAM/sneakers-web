import { MOCK_MARKER } from "@sneakers-web/mock-gateway";

import type { Edge } from "@/lib/osadmin/edgeTypes";
import type {
  Admin,
  BackupPolicy,
  ElevationOverride,
  ElevationPolicy,
  FactoryReset,
  NetdSettings,
  Session,
  UpdatePackage,
  UpgradePolicy,
} from "@/lib/osadmin/types";

import { OsadminError } from "@/lib/osadmin/errors";
import { getSession } from "@/lib/osadmin/sessionStore";
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
let upgradePolicy = structuredClone(world.UPGRADE_POLICY);
const upgradeHistory = structuredClone(world.UPGRADE_HISTORY);
let runningVersion = "0.1.0";
let stagedVersion = "";
let failedVersion = "";
const uploads = new Map<string, Blob>();
let uploadCount = 0;
/** Scenario switches for the review screen list and the tests (see applyMockScenario). */
let uploadStalls = false;
let verifyStalls = false;
let stepUpOnce = false;
/** With the "stepup" scenario the fresh sign-in is never approved, so the dialog stays up. */
let signInHolds = false;

const RESET_DELAY_MS = 10 * 60_000;
const RESET_PENDING_MS = 30 * 60_000;
const SINGLE_ADMIN_REASON =
  "RESET_UNAVAILABLE: a factory reset needs a quorum of at least two admins; with one admin, delete and re-create or re-flash the box instead";

const unimplemented = (message: string) => new OsadminError("unimplemented", message);
const notFound = (message: string) => new OsadminError("not_found", message);

const findAdmin = (name: string) => admins.find((a) => a.name === name);

const never = () => new Promise<never>(() => {});

const caller = (): string => getSession()?.admin ?? "";

/** The step-up-gated methods refuse once after the "stepup" scenario, as a stale sign-in would. */
const STEP_UP_METHODS = new Set([
  "PowerService/ApproveFactoryReset",
  "PowerService/StartFactoryReset",
  "UpgradeService/ApplyUpdate",
  "UpgradeService/RevertUpdate",
  "UpgradeService/SetUpgradePolicy",
  "UpgradeService/StageUpdate",
]);

const historyEntry = (
  action: "apply" | "fetch" | "revert" | "stage",
  version: string,
  code = "",
  detail = "",
) =>
  upgradeHistory.unshift({
    action,
    actor: caller(),
    code,
    detail,
    outcome: code ? "failed" : "ok",
    time: new Date().toISOString(),
    version,
  });

// The mock box's verification: a file whose content says "tampered" fails the signature, and
// "lab" fails the channel, the way a real .bin's signed header would.
const verify = async (uploadId: string): Promise<UpdatePackage> => {
  const blob = uploads.get(uploadId);
  if (!blob)
    throw new OsadminError("failed_precondition", `UPGRADE_UPLOAD: there is no upload ${uploadId}`);
  const content = await blob.text();
  if (content.includes("tampered")) {
    uploads.delete(uploadId);
    throw new OsadminError(
      "failed_precondition",
      "UPGRADE_SIGNATURE: the update package isn't signed by this box's release key, or it changed after it was signed",
    );
  }
  if (content.includes("lab")) {
    uploads.delete(uploadId);
    throw new OsadminError(
      "failed_precondition",
      "UPGRADE_CHANNEL: a lab package never installs on a production box",
    );
  }
  const patch = content.includes("patch");
  return {
    arch: "amd64",
    bases: patch ? [runningVersion] : [],
    channel: "stable",
    kind: patch ? "patch" : "full",
    sha256: Array.from({ length: 32 }, (_, index) =>
      (index * 7 + 11).toString(16).padStart(2, "0"),
    ).join(""),
    size: String(blob.size),
    uploadId,
    version: patch ? "0.1.1" : "0.2.0",
  };
};

const isOwner = (name: string) => findAdmin(name)?.role === "ROLE_OWNER";

// Apply and Revert refuse while an elevated shell is open, unless an owner's override names it
// with the typed "<admin> <id>" and a reason; the shell is ended before the update goes ahead,
// as on the box. Returns the history line's detail.
const holdForElevation = (what: string, override?: ElevationOverride): string => {
  const open = elevations.filter((item) => item.state === "active");
  const other = open.find((item) => item.id !== override?.elevationId);
  if (other)
    throw new OsadminError(
      "failed_precondition",
      `UPGRADE_ELEVATED: ${other.admin} has an elevated shell open (${other.id}); it must end, or an owner ends it with an override, before the ${what}`,
    );
  const held = open.find((item) => item.id === override?.elevationId);
  if (!held || !override) return "";
  if (!isOwner(caller()))
    throw new OsadminError(
      "permission_denied",
      "ACCESS_FORBIDDEN: only an owner can end an elevated shell to apply or revert",
    );
  const want = `${held.admin} ${held.id}`;
  if (override.confirm.trim() !== want)
    throw new OsadminError(
      "invalid_argument",
      `ACCESS_CONFIRM: type "${want}" to confirm ending ${held.admin}'s elevated shell`,
    );
  if (!override.reason.trim())
    throw new OsadminError(
      "invalid_argument",
      `ACCESS_CONFIRM: say why ${held.admin}'s elevated shell is ended, in at most 500 characters`,
    );
  held.state = "ended";
  auditEvents.unshift({
    action: "elevation.terminate",
    actor: caller(),
    code: "",
    detail: { admin: held.admin, for: what, reason: override.reason.trim() },
    keyFingerprint: "",
    outcome: "ok",
    sourceAddress: "192.0.2.10",
    target: held.id,
    time: new Date().toISOString(),
  });
  return `ended elevated shell ${held.id}`;
};

const powerState = () => {
  if (factoryReset?.runsAt && Date.parse(factoryReset.runsAt) <= Date.now())
    factoryReset = undefined;
  if (
    factoryReset?.expires &&
    !factoryReset.runsAt &&
    Date.parse(factoryReset.expires) <= Date.now()
  )
    factoryReset = undefined;
  const available =
    admins.length > 1 && quorum.members.length >= quorum.required && quorum.required >= 2;
  return { available, reason: available ? "" : SINGLE_ADMIN_REASON };
};

const startReset = (actor: string, confirmHostname: string) => {
  if (findAdmin(actor)?.role !== "ROLE_OWNER")
    throw new OsadminError(
      "permission_denied",
      "ACCESS_FORBIDDEN: only an owner can start a factory reset",
    );
  if (confirmHostname !== world.HOSTNAME)
    throw new OsadminError(
      "invalid_argument",
      "ACCESS_CONFIRM: the typed confirmation doesn't match",
    );
  if (!powerState().available) throw new OsadminError("failed_precondition", SINGLE_ADMIN_REASON);
  if (factoryReset)
    throw new OsadminError(
      "failed_precondition",
      "RESET_UNAVAILABLE: a factory reset is already in progress",
    );
  const now = Date.now();
  factoryReset = {
    approvals: quorum.members.includes(actor) ? [actor] : [],
    expires: new Date(now + RESET_PENDING_MS).toISOString(),
    id: "R-MOCK01",
    members: [...quorum.members],
    required: quorum.required,
    started: new Date(now).toISOString(),
    startedBy: actor,
    state: "FACTORY_RESET_STATE_PENDING",
  };
  return factoryReset;
};

const approveReset = (actor: string, id: string) => {
  const reset = factoryReset;
  if (!reset || reset.id !== id)
    throw new OsadminError(
      "failed_precondition",
      `RESET_CANCELLED: there is no factory reset "${id}" in progress`,
    );
  if (!reset.members.includes(actor))
    throw new OsadminError(
      "failed_precondition",
      `RESET_APPROVED: ${actor} isn't on the quorum roster`,
    );
  if (reset.approvals.includes(actor))
    throw new OsadminError(
      "failed_precondition",
      `RESET_APPROVED: ${actor}'s approval is already counted; another roster member must approve`,
    );
  if (reset.runsAt)
    throw new OsadminError(
      "failed_precondition",
      "RESET_APPROVED: the quorum has already approved",
    );
  reset.approvals = [...reset.approvals, actor];
  if (reset.approvals.length >= reset.required) {
    reset.state = "FACTORY_RESET_STATE_COUNTDOWN";
    reset.runsAt = new Date(Date.now() + RESET_DELAY_MS).toISOString();
  }
  return reset;
};

const route = async (service: string, method: string, body: Record<string, unknown>) => {
  const key = `${service}/${method}`;
  if (stepUpOnce && STEP_UP_METHODS.has(key)) {
    stepUpOnce = false;
    throw new OsadminError(
      "permission_denied",
      "ACCESS_STEPUP_REQUIRED: this action needs a sign-in no older than 5 minutes",
    );
  }
  switch (key) {
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
    case "PowerService/ApproveFactoryReset": {
      return { factoryReset: structuredClone(approveReset(caller(), body.id as string)) };
    }
    case "PowerService/CancelFactoryReset": {
      if (!factoryReset || (body.id && factoryReset.id !== body.id))
        throw new OsadminError(
          "failed_precondition",
          "RESET_CANCELLED: there is no factory reset in progress",
        );
      factoryReset = undefined;
      return {};
    }
    case "PowerService/GetPower": {
      const { available, reason } = powerState();
      return {
        factoryReset: structuredClone(factoryReset),
        factoryResetAvailable: available,
        factoryResetUnavailableReason: reason,
        sessions: [
          { admin: "alice", signedIn: new Date().toISOString(), sourceAddress: "192.0.2.10" },
        ],
      };
    }
    case "PowerService/Reboot":
    case "PowerService/Shutdown": {
      return {};
    }
    case "PowerService/StartFactoryReset": {
      return {
        factoryReset: structuredClone(startReset(caller(), body.confirmHostname as string)),
      };
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
      if (signInHolds) return { state: "SIGN_IN_STATE_PENDING" };
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
      powerState();
      return {
        ...world.status(),
        factoryReset: structuredClone(factoryReset),
        failedVersion,
        protection: secureBootOn ? "PROTECTION_FULL" : "PROTECTION_REDUCED",
        runningVersion,
        stagedVersion,
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
    case "UpgradeService/ApplyUpdate": {
      if (!stagedVersion)
        throw new OsadminError("failed_precondition", "UPGRADE_NOT_STAGED: no release is staged");
      const detail = holdForElevation(
        "update applies",
        body.elevationOverride as ElevationOverride | undefined,
      );
      historyEntry("apply", stagedVersion, "", detail);
      runningVersion = stagedVersion;
      stagedVersion = "";
      return {};
    }
    case "UpgradeService/FetchUpdate": {
      if (!upgradePolicy.mirrorUrl)
        throw new OsadminError(
          "failed_precondition",
          "UPGRADE_AIR_GAPPED: no mirror is configured, so this box never fetches; upload the .bin instead",
        );
      const fileName = body.fileName as string;
      if (!/^sneakers-appliance-\d+\.\d+\.\d+(-[\w.]+)?-(amd64|arm64)\.bin$/.test(fileName))
        throw new OsadminError(
          "failed_precondition",
          `UPGRADE_UPLOAD: "${fileName}" isn't a sneakers-appliance .bin name`,
        );
      const uploadId = `fetch-${String(++uploadCount)}`;
      uploads.set(
        uploadId,
        new Blob([fileName.includes("0.1.1") ? "signed patch" : "signed release"]),
      );
      historyEntry("fetch", "");
      return { uploadId };
    }
    case "UpgradeService/GetUpgrades": {
      return {
        activeElevations: structuredClone(elevations.filter((item) => item.state === "active")),
        airGapped: !upgradePolicy.mirrorUrl,
        failedVersion,
        history: structuredClone(upgradeHistory),
        policy: structuredClone(upgradePolicy),
        runningVersion,
        stagedVersion,
      };
    }
    case "UpgradeService/RevertUpdate": {
      const detail = holdForElevation(
        "update reverts",
        body.elevationOverride as ElevationOverride | undefined,
      );
      historyEntry("revert", "", "", detail);
      return {};
    }
    case "UpgradeService/SetUpgradePolicy": {
      const policy = body.policy as UpgradePolicy;
      if (
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(policy.windowStart) ||
        policy.windowMinutes < 45 ||
        policy.windowMinutes > 720
      )
        throw new OsadminError(
          "invalid_argument",
          "ACCESS_CONFIRM: the window starts at HH:MM and lasts 45 to 720 minutes",
        );
      upgradePolicy = { ...policy, mirrorUrl: policy.mirrorUrl.trim().replace(/\/+$/, "") };
      return {};
    }
    case "UpgradeService/StageUpdate": {
      if (verifyStalls) return never();
      const uploadId = body.uploadId as string;
      try {
        const updatePackage = await verify(uploadId);
        stagedVersion = updatePackage.version;
        historyEntry("stage", updatePackage.version);
        return { package: updatePackage };
      } catch (error) {
        historyEntry("stage", "", error instanceof OsadminError ? (error.symbol ?? "") : "");
        throw error;
      }
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
  async upload(
    bytes: Blob,
    onProgress?: (fraction: number) => void,
  ): Promise<{ uploadId: string }> {
    onProgress?.(0.4);
    if (uploadStalls) return never();
    const uploadId = `upload-${String(++uploadCount)}`;
    uploads.set(uploadId, bytes);
    onProgress?.(1);
    return { uploadId };
  },
};

const refill = <T>(target: T[], source: readonly T[]) => {
  target.splice(0, target.length, ...structuredClone(source));
};

export type MockScenario =
  | "air-gapped"
  | "elevated"
  | "failed"
  | "manual"
  | "reset-countdown"
  | "reset-pending"
  | "single-admin"
  | "staged"
  | "stepup"
  | "uploading"
  | "verifying";

const pendingReset = (): FactoryReset => ({
  approvals: ["alice"],
  expires: new Date(Date.now() + RESET_PENDING_MS).toISOString(),
  id: "R-MOCK01",
  members: [...quorum.members],
  required: quorum.required,
  started: new Date().toISOString(),
  startedBy: "alice",
  state: "FACTORY_RESET_STATE_PENDING",
});

/**
 * Puts the mock box into one of the states the review screen list shows (and the tests use):
 * an air-gapped box, a staged release, a stalled upload or verification, a factory reset
 * waiting for its quorum or counting down, and so on.
 */
export const applyMockScenario = (scenario: MockScenario): void => {
  switch (scenario) {
    case "air-gapped": {
      upgradePolicy = { ...upgradePolicy, mirrorUrl: "" };
      break;
    }
    case "elevated": {
      if (!elevations.some((item) => item.id === world.ACTIVE_ELEVATION.id))
        elevations.push(structuredClone(world.ACTIVE_ELEVATION));
      break;
    }
    case "failed": {
      failedVersion = "0.2.0";
      break;
    }
    case "manual": {
      upgradePolicy = { ...upgradePolicy, mode: "manual" };
      break;
    }
    case "reset-countdown": {
      factoryReset = {
        ...pendingReset(),
        approvals: [...quorum.members],
        runsAt: new Date(Date.now() + RESET_DELAY_MS).toISOString(),
        state: "FACTORY_RESET_STATE_COUNTDOWN",
      };
      break;
    }
    case "reset-pending": {
      factoryReset = pendingReset();
      break;
    }
    case "single-admin": {
      admins.splice(1);
      quorum = { configured: false, members: ["alice"], required: 1 };
      break;
    }
    case "staged": {
      stagedVersion = "0.2.0";
      break;
    }
    case "stepup": {
      stepUpOnce = true;
      signInHolds = true;
      break;
    }
    case "uploading": {
      uploadStalls = true;
      break;
    }
    case "verifying": {
      verifyStalls = true;
      break;
    }
  }
};

const SCENARIOS = new Set<string>([
  "air-gapped",
  "elevated",
  "failed",
  "manual",
  "reset-countdown",
  "reset-pending",
  "single-admin",
  "staged",
  "stepup",
  "uploading",
  "verifying",
] satisfies MockScenario[]);

/** `?mockScenario=staged,reset-pending` on a mock build's URL, for the review screen list. */
const scenariosFromUrl = (): void => {
  const search = globalThis.location?.search ?? "";
  const names = new URLSearchParams(search).get("mockScenario")?.split(",") ?? [];
  for (const name of names) if (SCENARIOS.has(name)) applyMockScenario(name as MockScenario);
};

/** Resets every mutable piece of the mock world, so tests don't see another test's writes. */
export const resetMockWorld = (): void => {
  upgradePolicy = structuredClone(world.UPGRADE_POLICY);
  runningVersion = "0.1.0";
  stagedVersion = "";
  failedVersion = "";
  uploads.clear();
  uploadCount = 0;
  uploadStalls = false;
  verifyStalls = false;
  stepUpOnce = false;
  signInHolds = false;
  refill(upgradeHistory, world.UPGRADE_HISTORY);
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

scenariosFromUrl();
