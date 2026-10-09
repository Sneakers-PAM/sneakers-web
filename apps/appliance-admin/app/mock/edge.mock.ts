import { MOCK_MARKER } from "@sneakers-web/mock-gateway";

import type {
  AccessPolicy,
  Admin,
  BackupPolicy,
  CodeKind,
  ElevationOverride,
  FactoryReset,
  NetdSettings,
  Session,
  UpdatePackage,
  UpdateTarget,
  UpgradePolicy,
  UpgradeProgress,
  UpgradeStep,
} from "@/lib/osadmin/types";

import { type Edge, UPLOAD_CANCELLED, type UploadOptions } from "@/lib/osadmin/edgeTypes";
import { OsadminError } from "@/lib/osadmin/errors";
import { getSession } from "@/lib/osadmin/sessionStore";
import {
  applyCertificateScenario,
  CERTIFICATE_SCENARIOS,
  type CertificateScenario,
  certificatesRequest,
  resetCertificates,
} from "@/mock/certificates.mock";
import {
  applyMirrorScenario,
  MIRROR_SCENARIOS,
  mirrorFetch,
  type MirrorScenario,
  mirrorStatus,
  mirrorTrustRequest,
  resetMirror,
  updateTrust,
} from "@/mock/mirror.mock";
import * as world from "@/mock/world";

/** The banner every screen shows while the app runs against the mock transport. */
export const MOCK_BANNER = `MOCK DATA, not a real box (${MOCK_MARKER})`;

export { MOCK_INVITE_CODE, MOCK_PASSWORD, MOCK_SETUP_CODE, MOCK_WRONG_CODE } from "@/mock/world";

const REFUSAL_TYPE = "sneakers.appliance.osadmin.v1.SignInRefusal";

/** A refusal with a SignInRefusal detail in its JSON debug form, as connect-go sends it. */
const refused = (
  message: string,
  refusal: {
    attemptsLeft?: number;
    lockedUntil?: string;
    lockedUntilUnlocked?: boolean;
    retryAfter?: string;
  },
) =>
  new OsadminError("unauthenticated", message, undefined, [
    { debug: { attemptsLeft: 0, ...refusal }, type: REFUSAL_TYPE, value: "" },
  ]);

/** Checks the TOTP code (and the password, for a sign-in) and counts a failure toward the lockout. */
const checkCredentials = (name: string, password: null | string, code: string): void => {
  if (throttledUntil && Date.parse(throttledUntil) > Date.now())
    throw refused("SIGNIN_THROTTLED: too many tries from this address", {
      retryAfter: throttledUntil,
    });
  const lock = locks.get(name);
  if (lock && (lock.untilUnlocked || (lock.until && Date.parse(lock.until) > Date.now())))
    throw refused("SIGNIN_LOCKED: the account is locked", {
      lockedUntil: lock.until,
      lockedUntilUnlocked: lock.untilUnlocked,
    });
  const admin = findAdmin(name);
  const ok =
    !!admin &&
    (password === null || password === world.MOCK_PASSWORD) &&
    /^\d{6}$/.test(code) &&
    code !== world.MOCK_WRONG_CODE;
  if (ok) {
    failures.delete(name);
    locks.delete(name);
    return;
  }
  if (!admin)
    throw refused("SIGNIN_REFUSED: the name, the password or the code is wrong", {
      attemptsLeft: MAX_FAILURES - 1,
    });
  const failed = (failures.get(name) ?? 0) + 1;
  failures.set(name, failed);
  if (failed >= MAX_FAILURES) {
    const untilUnlocked = lockoutMode === "LOCKOUT_MODE_UNTIL_UNLOCKED";
    const until = untilUnlocked
      ? undefined
      : new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString();
    locks.set(name, { until, untilUnlocked });
    throw refused("SIGNIN_LOCKED: the account is locked", {
      lockedUntil: until,
      lockedUntilUnlocked: untilUnlocked,
    });
  }
  throw refused("SIGNIN_REFUSED: the name, the password or the code is wrong", {
    attemptsLeft: MAX_FAILURES - failed,
  });
};

/** The session a real box keeps in its HttpOnly cookie, for GetSession after a reload. */
let cookieSession: null | Session = null;

/** A redeemed one-time code's session, before its admin can sign in. */
let codeSession: { admin: string; kind: CodeKind } | null = null;
/** Open invitation codes, by code (normalised), to the admin they're for. */
const invitations = new Map<string, string>();
/** BeginCredentials' enrolments waiting for a code from the new authenticator. */
const enrolments = new Map<string, { admin: string; kind: CodeKind }>();
let codeTries = 5;
let networkSeen = false;
let protectionSeen = false;
/** An admin has signed in with a password and a TOTP code since first boot. */
let signedInOnce = true;
let custodyMode = "tpm";

const normalCode = (code: string): string => code.replaceAll(/[\s-]/g, "").toUpperCase();

const NAME_PATTERN = /^[a-z][a-z0-9-]{0,31}$/;
const RESERVED_NAMES = new Set(["admin", "enrol", "root", "sneakers"]);

const passwordCheck = (password: string, admin: string) => {
  if (password.length < 12)
    return { message: "Use at least 12 characters.", minLength: 12, ok: false, tooShort: true };
  if (world.BREACHED_PASSWORDS.includes(password))
    return {
      breached: true,
      message: "This password is on a list of breached passwords. Pick another.",
      minLength: 12,
      ok: false,
    };
  if (admin && password.toLowerCase() === admin.toLowerCase())
    return { message: "The password can't be the admin's name.", minLength: 12, ok: false };
  return { minLength: 12, ok: true };
};

const setupSteps = () => {
  const done = [
    admins.length > 0 || !!codeSession,
    admins.length > 0,
    recoveryKeys.length > 0,
    networkSeen,
    protectionSeen,
    setupDone,
  ];
  const kinds = ["CODE", "ADMIN", "RECOVERY_KEYS", "NETWORK", "PROTECTION", "SIGN_IN"] as const;
  const steps = kinds.map((kind, index) => ({
    done: done[index],
    kind: `SETUP_STEP_KIND_${kind}` as const,
    number: index + 1,
    optional: kind === "NETWORK",
  }));
  const open = done.findIndex((d) => !d);
  return { current: setupDone ? 0 : open + 1, steps };
};

let networkPending: { settings: NetdSettings; token: string; until: number } | null = null;

const NETWORK_REVERT_SECONDS = 120;
const modules = structuredClone(world.MODULES);
const recoveryKeys = structuredClone(world.RECOVERY_KEYS);
const admins = structuredClone(world.ADMINS);
const elevations = structuredClone(world.ELEVATIONS);
const revokedKeys = structuredClone(world.REVOKED_KEYS);
const sessions = structuredClone(world.SESSIONS);
const auditEvents = structuredClone(world.AUDIT_EVENTS);
let quorum = structuredClone(world.QUORUM);
let accessPolicy = structuredClone(world.ACCESS_POLICY);
let keySerial = 100;
let inviteCount = 0;
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** A new 24-hour invitation code for the admin, as AddAdmin and ReinviteAdmin answer. */
const invite = (admin: string) => {
  inviteCount++;
  const code = Array.from({ length: 8 }, (_, index) =>
    CROCKFORD.charAt((inviteCount * 7 + index * 13 + admin.length) % CROCKFORD.length),
  ).join("");
  const formatted = `${code.slice(0, 4)}-${code.slice(4)}`;
  invitations.set(normalCode(formatted), admin);
  const expires = new Date(Date.now() + 24 * 3_600_000).toISOString();
  const target = findAdmin(admin);
  if (target) target.inviteExpires = expires;
  return { admin, code: formatted, expires };
};
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
/** The product bundle's slots on the state volume. */
let product = structuredClone(world.PRODUCT_SLOTS);
/** This build has a release source to fetch from directly. */
const DIRECT_AVAILABLE = true;
const isAirGapped = () => !upgradePolicy.mirrorUrl && !upgradePolicy.direct;
/** A fetch tries the mirror first; its refusal stands when there's no release source to try. */
const fromMirror = () => {
  if (!upgradePolicy.mirrorUrl) return;
  const refusal = mirrorFetch(upgradePolicy.mirrorUrl);
  if (refusal && !upgradePolicy.direct) throw refusal;
};
const isProduct = (target: unknown) => target === "UPDATE_TARGET_PRODUCT";
const newer = (a: string, b: string) => {
  const [x, y] = [a, b].map((v) => v.split(".").map(Number));
  for (let index = 0; index < 3; index++)
    if ((x?.[index] ?? 0) !== (y?.[index] ?? 0)) return (x?.[index] ?? 0) > (y?.[index] ?? 0);
  return false;
};
let failedVersion = "";
/** The last base revert an admin asked for: the release reverted from, who, and when. */
let reverted: { revertedAt: string; revertedBy: string; revertedVersion: string } | null = null;
/** The older release kept in the other slot for a revert: the box was updated from 0.0.9. */
const PREVIOUS_VERSION = "0.0.9";
let previousVersion = PREVIOUS_VERSION;
/** The revert target and its slot as Status and Updates report them; staging replaces it. */
const previousSlot = () => ({ previousSlot: previousVersion ? "B" : "", previousVersion });
/** While set, the mock box is restarting: :8443 doesn't answer until then, and the restart ends
 * every session. */
let restartingUntil = 0;
const RESTART_MS = 3000;
const restart = () => {
  restartingUntil = Date.now() + RESTART_MS;
};
/** The last stage, apply or revert, step by step, as osadmin keeps it. */
let upgradeProgress: undefined | UpgradeProgress;
/** A product install or revert restarts the product services: they answer running after this
 * many GetUpgrades, or the restart step fails when productRestartFails is set. */
const PRODUCT_RESTART_POLLS = 2;
let productRestartPolls = 0;
let productRestartFails = false;
/** Starts the product services' restart on version, stopped until it ends. */
const restartProduct = (action: "apply" | "revert", version: string) => {
  upgradeProgress = progressAt(action, "UPDATE_TARGET_PRODUCT", version, "restart", "ACTIVE");
  productRestartPolls = PRODUCT_RESTART_POLLS;
};
/** One GetUpgrades further into the product's restart. */
const advanceProductRestart = () => {
  if (productRestartPolls === 0 || --productRestartPolls > 0 || !upgradeProgress) return;
  const { action, version } = upgradeProgress;
  if (productRestartFails) {
    upgradeProgress = progressAt(action, "UPDATE_TARGET_PRODUCT", version, "restart", "FAILED", {
      detail: "The product services didn't come up.",
    });
    return;
  }
  upgradeProgress = progressAt(action, "UPDATE_TARGET_PRODUCT", version, "restart", "DONE");
  product = { ...product, running: true };
};
/** After a reboot the box checks its health this long before it marks the release good. */
const CHECK_MS = 1500;
let checkingUntil = 0;
const STEP_LABELS: Record<string, string> = {
  health: "Checking health",
  mark_good: "Marking good",
  reboot: "Rebooting",
  restart: "Restarting the product",
  switch: "Switching slots",
  verify: "Verifying (signature, channel, SHA-256)",
};
const stepIds = (action: UpgradeProgress["action"], target: UpdateTarget): string[] => {
  const after =
    target === "UPDATE_TARGET_PRODUCT"
      ? ["switch", "restart"]
      : ["switch", "reboot", "health", "mark_good"];
  return action === "revert" ? after : ["verify", "stage", ...after];
};
/** The steps with `at` in state, the ones before it done and the ones after it pending. */
const progressAt = (
  action: UpgradeProgress["action"],
  target: UpdateTarget,
  version: string,
  at: string,
  state: "ACTIVE" | "DONE" | "FAILED",
  more: { code?: string; detail?: string; doneBytes?: string; totalBytes?: string } = {},
): UpgradeProgress => {
  const ids = stepIds(action, target);
  const index = ids.indexOf(at);
  const steps = ids.map((id, index_): UpgradeStep => ({
    detail: index_ === index ? (more.detail ?? "") : "",
    doneBytes: index_ === index ? (more.doneBytes ?? "0") : "0",
    id,
    label:
      id === "stage"
        ? target === "UPDATE_TARGET_PRODUCT"
          ? "Staging into the free product slot"
          : "Staging into slot B"
        : (STEP_LABELS[id] ?? id),
    state:
      index_ < index
        ? "UPGRADE_STEP_STATE_DONE"
        : index_ === index
          ? `UPGRADE_STEP_STATE_${state}`
          : "UPGRADE_STEP_STATE_PENDING",
    totalBytes: index_ === index ? (more.totalBytes ?? "0") : "0",
  }));
  const now = new Date().toISOString();
  return {
    action,
    code: more.code ?? "",
    failed: state === "FAILED",
    inProgress: state === "ACTIVE",
    startedAt: now,
    steps,
    target,
    updatedAt: now,
    version,
  };
};
const activeStep = (): string =>
  upgradeProgress?.steps.find((step) => step.state === "UPGRADE_STEP_STATE_ACTIVE")?.id ?? "";
/** After the reboot the booted release checks its health, then marks itself good. */
const advanceProgress = () => {
  if (!upgradeProgress?.inProgress || (restartingUntil && Date.now() < restartingUntil)) return;
  const { action, target, version } = upgradeProgress;
  const base = target ?? "UPDATE_TARGET_BASE";
  if (activeStep() === "reboot") {
    upgradeProgress = progressAt(action, base, version, "health", "ACTIVE");
    checkingUntil = Date.now() + CHECK_MS;
  } else if (activeStep() === "health" && Date.now() >= checkingUntil) {
    upgradeProgress = progressAt(action, base, version, "mark_good", "DONE");
  }
};
/** The steps alone, as the public GetPhase gives them. */
const publicProgress = (): undefined | UpgradeProgress =>
  upgradeProgress && {
    action: upgradeProgress.action,
    code: "",
    failed: upgradeProgress.failed,
    inProgress: upgradeProgress.inProgress,
    steps: upgradeProgress.steps.map((step) => ({ ...step, detail: "" })),
    target: upgradeProgress.target,
    version: "",
  };
/** Apply and Revert take a fresh authenticator code on every call, not the step-up window. */
const checkCallCode = (code: unknown): void => {
  const value = typeof code === "string" ? code.trim() : "";
  if (!value)
    throw new OsadminError(
      "invalid_argument",
      "ACCESS_CONFIRM: type a new code from your authenticator to confirm",
    );
  checkCredentials(caller(), null, value);
};
const uploads = new Map<string, Blob>();
/** What the box knows of each held upload, for GetUpgrades.heldUpload. */
const uploadInfo = new Map<string, { fileName: string; receivedAt: string; source: string }>();
/** True while an upload is coming in. */
let receiving = false;
/** GetUpgrades answers still to say receiving after a cancel, as the box notices it late. */
let receivingAfterCancel = 0;
const noticeCancel = () => {
  if (receivingAfterCancel === 0) return false;
  receivingAfterCancel--;
  return true;
};
let uploadCount = 0;
/** Scenario switches for the review screen list and the tests (see applyMockScenario). */
let uploadStalls = false;
/** Status answers as the box does while accessd isn't answering. */
let statusFails = false;
let verifyStalls = false;
let stepUpOnce = false;
/** Sign-in failures in the current window, and the lockouts they caused, by admin. */
const failures = new Map<string, number>();
const locks = new Map<string, { until?: string; untilUnlocked: boolean }>();
/** While set, this browser's address is throttled until then. */
let throttledUntil = "";
const MAX_FAILURES = 3;
const LOCK_MINUTES = 15;

const RESET_DELAY_MS = 10 * 60_000;
const RESET_PENDING_MS = 30 * 60_000;
const SINGLE_ADMIN_REASON =
  "RESET_UNAVAILABLE: a factory reset needs a quorum of at least two admins; with one admin, delete and re-create or re-flash the box instead";

const unimplemented = (message: string) => new OsadminError("unimplemented", message);
const notFound = (message: string) => new OsadminError("not_found", message);

const findAdmin = (name: string) => admins.find((a) => a.name === name);

const never = () => new Promise<never>(() => {});

const caller = (): string => getSession()?.admin ?? "";

let lockoutMode: "LOCKOUT_MODE_TIMED" | "LOCKOUT_MODE_UNTIL_UNLOCKED" = "LOCKOUT_MODE_TIMED";

const sessionOf = (admin: Admin): Session =>
  world.sessionFor(admin, quorum.members.includes(admin.name));

/** The step-up-gated methods refuse once after the "stepup" scenario, as a stale sign-in would. */
const STEP_UP_METHODS = new Set([
  "AccessService/AddAdmin",
  "AccessService/UnrevokeKey",
  "PowerService/ApproveFactoryReset",
  "PowerService/StartFactoryReset",
  "TlsService/AssignCertificate",
  "TlsService/RevertToSelfSigned",
]);

const historyEntry = (
  action: "apply" | "discard" | "fetch" | "revert" | "stage",
  version: string,
  code = "",
  detail = "",
  target: UpdateTarget = "UPDATE_TARGET_BASE",
) =>
  upgradeHistory.unshift({
    action,
    actor: caller(),
    code,
    detail,
    outcome: code ? "failed" : "ok",
    target,
    time: new Date().toISOString(),
    version,
  });

const holdUpload = (uploadId: string, blob: Blob, fileName: string, source: string) => {
  uploads.set(uploadId, blob);
  uploadInfo.set(uploadId, { fileName, receivedAt: new Date().toISOString(), source });
};

const dropUpload = (uploadId: string) => {
  uploads.delete(uploadId);
  uploadInfo.delete(uploadId);
};

/** As on the box: one file at a time, so a file coming in or held refuses the next. */
const checkNotBusy = () => {
  if (receiving)
    throw new OsadminError(
      "failed_precondition",
      "UPGRADE_BUSY: a file is already coming in; wait for it, or cancel it, first",
    );
  const held = [...uploadInfo.entries()].at(-1);
  if (held)
    throw new OsadminError(
      "failed_precondition",
      `UPGRADE_BUSY: a file is already waiting (${held[1].fileName || `upload ${held[0]}`}); verify it or cancel it first`,
    );
};

const heldUpload = () => {
  const held = [...uploadInfo.entries()].at(-1);
  if (!held) return;
  const [uploadId, info] = held;
  return { ...info, size: String(uploads.get(uploadId)?.size ?? 0), uploadId };
};

/** A product bundle's base range fits base: at least min, and at most max when it has one. */
const inRange = (base: string, minBase: string, maxBase: string) =>
  !newer(minBase, base) && (!maxBase || !newer(base, maxBase));

// The mock box's verification: a file whose content says "tampered" fails the signature, and
// "lab" fails the channel, the way a real .bin's signed header would. A product bundle that
// says "needs 9.0.0" needs a newer base than the box runs.
const verify = async (uploadId: string): Promise<UpdatePackage> => {
  const blob = uploads.get(uploadId);
  if (!blob)
    throw new OsadminError("failed_precondition", `UPGRADE_UPLOAD: there is no upload ${uploadId}`);
  const content = await blob.text();
  if (content.includes("tampered")) {
    dropUpload(uploadId);
    throw new OsadminError(
      "failed_precondition",
      "UPGRADE_SIGNATURE: the update package isn't signed by this box's release key, or it changed after it was signed",
    );
  }
  if (content.includes("lab")) {
    dropUpload(uploadId);
    throw new OsadminError(
      "failed_precondition",
      "UPGRADE_CHANNEL: a lab package never installs on a production box",
    );
  }
  if (content.includes("product")) {
    const version = /\d+\.\d+\.\d+/.exec(content)?.[0] ?? "0.2.0";
    const needs = /needs (\d+\.\d+\.\d+)/.exec(content)?.[1];
    if (needs && !inRange(runningVersion, needs, "")) {
      dropUpload(uploadId);
      throw new OsadminError(
        "failed_precondition",
        `UPGRADE_PRODUCT_BASE: the product bundle ${version} needs base ${needs} or newer; this box runs ${runningVersion}`,
      );
    }
    return {
      arch: "amd64",
      bases: [],
      channel: "stable",
      kind: "full",
      maxBase: "",
      minBase: needs ?? runningVersion,
      sha256: Array.from({ length: 32 }, (_, index) =>
        (index * 5 + 3).toString(16).padStart(2, "0"),
      ).join(""),
      size: String(blob.size),
      target: "UPDATE_TARGET_PRODUCT",
      uploadId,
      version,
    };
  }
  const patch = content.includes("patch");
  return {
    arch: "amd64",
    bases: patch ? [runningVersion] : [],
    channel: "stable",
    kind: patch ? "patch" : "full",
    maxBase: "",
    minBase: "",
    sha256: Array.from({ length: 32 }, (_, index) =>
      (index * 7 + 11).toString(16).padStart(2, "0"),
    ).join(""),
    size: String(blob.size),
    target: "UPDATE_TARGET_BASE",
    uploadId,
    version: patch ? "0.1.1" : "0.2.0",
  };
};

const isOwner = (name: string) => findAdmin(name)?.role === "ROLE_OWNER";

const removeKeys = (admin: Admin, fingerprints: string[]) => {
  for (const key of admin.keys.filter((k) => fingerprints.includes(k.fingerprint)))
    revokedKeys.push({
      admin: admin.name,
      fingerprint: key.fingerprint,
      revoked: new Date().toISOString(),
      revokedBy: caller() || "console",
      type: key.type,
    });
  admin.keys = admin.keys.filter((k) => !fingerprints.includes(k.fingerprint));
};

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
    detail: { admin: held.admin, for: what, id: held.id, reason: override.reason.trim() },
    keyFingerprint: "",
    outcome: "ok",
    sourceAddress: "192.0.2.10",
    target: `${held.admin}'s elevated shell`,
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
  if (key === "TlsService/SetUpdateTrust" || key === "TlsService/ClearUpdateTrust")
    return mirrorTrustRequest(method, body);
  if (key === "TlsService/GetCertificateStore")
    return { ...(certificatesRequest(method, body) as object), updateTrust: updateTrust() };
  if (service === "TlsService") return certificatesRequest(method, body);
  switch (key) {
    case "AccessService/AddAdmin": {
      const name = String(body.name ?? "").trim();
      if (!NAME_PATTERN.test(name) || RESERVED_NAMES.has(name))
        throw new OsadminError(
          "invalid_argument",
          "ACCESS_ADMIN_NAME: use lower-case letters, digits and dashes, starting with a letter",
        );
      if (findAdmin(name))
        throw new OsadminError("already_exists", `ACCESS_ADMIN_EXISTS: ${name} already exists`);
      const admin: Admin = {
        created: new Date().toISOString(),
        createdBy: caller(),
        credentialsSet: false,
        keys: [],
        name,
        role: (body.role as Admin["role"]) || "ROLE_ADMIN",
        uid: 20_000 + admins.length,
      };
      admins.push(admin);
      if (body.rootOperator === true)
        quorum = { ...quorum, configured: true, members: [...quorum.members, name] };
      return { admin, invitation: invite(name) };
    }
    case "AccessService/BeginTotpReplacement": {
      const id = `replace-${String(enrolments.size + 1)}`;
      enrolments.set(id, { admin: caller(), kind: "CODE_KIND_UNSPECIFIED" });
      return { totp: world.totpEnrolment(caller(), id) };
    }
    case "AccessService/ChangePassword": {
      if (body.currentPassword !== world.MOCK_PASSWORD)
        throw refused("ACCESS_PASSWORD: the current password is wrong", { attemptsLeft: 2 });
      const check = passwordCheck(String(body.newPassword ?? ""), caller());
      if (!check.ok)
        throw new OsadminError("invalid_argument", `ACCESS_PASSWORD: ${check.message}`);
      const admin = findAdmin(caller());
      if (admin) admin.passwordChanged = new Date().toISOString();
      return {};
    }
    case "AccessService/CompleteTotpReplacement": {
      const enrolment = enrolments.get(String(body.enrolmentId ?? ""));
      const code = String(body.totpCode ?? "");
      if (!enrolment)
        throw new OsadminError("failed_precondition", "ACCESS_ENROLMENT: start again");
      if (!/^\d{6}$/.test(code) || code === world.MOCK_WRONG_CODE)
        throw refused("ACCESS_TOTP: the code doesn't match the new authenticator", {
          attemptsLeft: 2,
        });
      enrolments.delete(String(body.enrolmentId));
      const admin = findAdmin(enrolment.admin);
      if (admin) admin.totpAdded = new Date().toISOString();
      return {};
    }
    case "AccessService/IssueSshKey": {
      checkCallCode(body.totpCode);
      const admin = findAdmin(caller());
      if (!admin)
        throw new OsadminError("unauthenticated", "ACCESS_UNAUTHENTICATED: sign in first");
      const days = Number(body.validDays) || accessPolicy.sshKeyValidDays;
      const serial = String(++keySerial);
      const key = {
        added: new Date().toISOString(),
        addedBy: admin.name,
        comment: String(body.label ?? "").trim(),
        fingerprint: `SHA256:iSsUeD${serial}k3Vw7Qm2Xp5Ln8Hc4Zb6Yd1Fs0Ga7Ej2K`,
        serial,
        type: "ssh-ed25519",
        validBefore: new Date(Date.now() + days * 86_400_000).toISOString(),
        via: "issued",
      };
      admin.keys.push(key);
      const fileName = `${admin.name}-sneakers-appliance`;
      return {
        certificate: `MOCK-SSH-CERTIFICATE-NOT-A-REAL-ONE ${admin.name}`,
        fileName,
        key,
        privateKey: [
          "-----BEGIN OPENSSH PRIVATE KEY-----", // gitleaks:allow (a placeholder, not a key)
          "b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW",
          "MOCK-PRIVATE-KEY-NOT-A-REAL-KEY-MOCK-PRIVATE-KEY-NOT-A-REAL-KEY",
          "-----END OPENSSH PRIVATE KEY-----", // gitleaks:allow
          "",
        ].join("\n"),
        publicKey: `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAMOCK ${admin.name}`,
      };
    }
    case "AccessService/ListAdmins": {
      return {
        accessPolicy: structuredClone(accessPolicy),
        admins: admins.map((admin) => {
          const lock = locks.get(admin.name);
          return {
            ...structuredClone(admin),
            failedAttempts: failures.get(admin.name) ?? 0,
            lockedUntil: lock?.until,
            lockedUntilUnlocked: lock?.untilUnlocked ?? false,
            rootOperator: quorum.members.includes(admin.name),
          };
        }),
        hostKeys: world.HOST_KEYS,
        quorum,
        revokedKeys: structuredClone(revokedKeys),
        rootKey: world.ROOT_KEY,
      };
    }
    case "AccessService/ReinviteAdmin": {
      const admin = findAdmin(String(body.name ?? ""));
      if (!admin) throw notFound(`there is no admin ${String(body.name)}`);
      if (admin.name === caller())
        throw new OsadminError("failed_precondition", "ACCESS_REINVITE_SELF: not for yourself");
      admin.credentialsSet = false;
      return { invitation: invite(admin.name) };
    }
    case "AccessService/RemoveAdmin": {
      if (admins.length <= 1) throw new OsadminError("failed_precondition", "ACCESS_LAST_OWNER");
      const index = admins.findIndex((a) => a.name === body.name);
      const admin = admins[index];
      if (admin) {
        removeKeys(
          admin,
          admin.keys.map((k) => k.fingerprint),
        );
        admins.splice(index, 1);
      }
      return {};
    }
    case "AccessService/RemoveKey": {
      const admin = findAdmin(body.admin as string);
      if (admin) removeKeys(admin, [body.fingerprint as string]);
      return {};
    }
    case "AccessService/SetAccessPolicy": {
      const policy = body.policy as AccessPolicy;
      const inRange = (value: number, max: number) =>
        Number.isInteger(value) && value >= 1 && value <= max;
      if (
        !inRange(policy.rootCodeMinutes, 60) ||
        !inRange(policy.rootSessionMinutes, 60) ||
        !inRange(policy.sshKeyValidDays, 1825)
      )
        throw new OsadminError(
          "invalid_argument",
          "ACCESS_POLICY: root-shell minutes are 1 to 60, and SSH key validity 1 to 1825 days",
        );
      accessPolicy = structuredClone(policy);
      lockoutMode =
        policy.lockoutMode === "LOCKOUT_MODE_UNTIL_UNLOCKED"
          ? policy.lockoutMode
          : "LOCKOUT_MODE_TIMED";
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
    case "AccessService/UnlockAdmin": {
      const name = String(body.name ?? "");
      locks.delete(name);
      failures.delete(name);
      return {};
    }
    case "AccessService/UnrevokeKey": {
      if (!isOwner(caller()))
        throw new OsadminError(
          "permission_denied",
          "ACCESS_FORBIDDEN: only an owner can un-revoke a key",
        );
      const index = revokedKeys.findIndex((k) => k.fingerprint === body.fingerprint);
      if (index === -1)
        throw new OsadminError(
          "invalid_argument",
          `ACCESS_KEY_TYPE: key ${String(body.fingerprint)} isn't revoked`,
        );
      revokedKeys.splice(index, 1);
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
      dropUpload(body.uploadId as string);
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
        ...(networkPending && {
          pendingChangeId: "net-1",
          pendingToken: networkPending.token,
          revertSecondsLeft: Math.max(0, Math.ceil((networkPending.until - Date.now()) / 1000)),
        }),
        serviceAddresses: [],
        settings: networkSettings,
      };
    }
    case "NetworkService/RunChecks": {
      return {
        checks: [
          { detail: "up", name: "link", skippable: true, state: "CHECK_STATE_OK" },
          { detail: "192.0.2.50/24", name: "address", state: "CHECK_STATE_OK" },
          {
            detail: "192.0.2.1 reachable",
            name: "gateway",
            skippable: true,
            state: "CHECK_STATE_OK",
          },
          {
            code: "NET_DNS",
            detail: "no DNS server answered for example.org",
            name: "dns",
            skippable: true,
            state: "CHECK_STATE_FAILED",
          },
          {
            code: "NET_NTP",
            detail: "not synced yet, offset 900 ms",
            name: "ntp",
            skippable: true,
            state: "CHECK_STATE_WARN",
          },
        ],
      };
    }
    case "NetworkService/SetNetwork": {
      const token = Math.random().toString(36).slice(2);
      const next = body.settings as NetdSettings;
      const address = (s: NetdSettings) =>
        s.addresses.find((a) => a.family === "ipv4" && a.mode === "static")?.address;
      const moves = address(next) !== address(networkSettings);
      networkPending = {
        settings: next,
        token,
        until: Date.now() + NETWORK_REVERT_SECONDS * 1000,
      };
      return {
        movesManagement: moves,
        newCertificate: moves || next.hostname !== networkSettings.hostname,
        ...(moves && address(next) && { newUrl: `https://${address(next)!}:8443/` }),
        revertAfterSeconds: NETWORK_REVERT_SECONDS,
        token,
      };
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
    case "PowerService/EndSession": {
      const index = sessions.findIndex((s) => s.id === body.id);
      if (index === -1) throw notFound(`there is no live session ${JSON.stringify(body.id)}`);
      sessions.splice(index, 1);
      return {};
    }
    case "PowerService/GetPower": {
      const { available, reason } = powerState();
      return {
        factoryReset: structuredClone(factoryReset),
        factoryResetAvailable: available,
        factoryResetUnavailableReason: reason,
        sessions: structuredClone(sessions),
      };
    }
    case "PowerService/ListSessions": {
      return { sessions: structuredClone(sessions) };
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
    case "RootShellService/IssueRootShellCode": {
      if (!quorum.members.includes(caller()))
        throw new OsadminError(
          "permission_denied",
          "ACCESS_FORBIDDEN: only root operators get root-shell codes",
        );
      if (!/^[0-9A-HJKMNP-TV-Z]{16}$/.test(normalCode(String(body.challenge ?? ""))))
        throw new OsadminError(
          "invalid_argument",
          "ROOTSHELL_CHALLENGE: that isn't a challenge from your SSH menu; it looks like XXXX-XXXX-XXXX-XXXX",
        );
      checkCredentials(caller(), null, String(body.totpCode ?? ""));
      return {
        code: "Q7XD-2PNR",
        expires: new Date(Date.now() + accessPolicy.rootCodeMinutes * 60_000).toISOString(),
        sessionMinutes: accessPolicy.rootSessionMinutes,
        sourceAddress: "192.0.2.50",
      };
    }
    case "SetupService/AcknowledgeSingleAdmin": {
      singleAdminAcknowledged = true;
      return {};
    }
    case "SetupService/AcknowledgeStep": {
      if (body.step === "SETUP_STEP_KIND_NETWORK") networkSeen = true;
      if (body.step === "SETUP_STEP_KIND_PROTECTION") protectionSeen = true;
      return {};
    }
    case "SetupService/BeginCredentials": {
      if (!codeSession)
        throw new OsadminError("unauthenticated", "ACCESS_UNAUTHENTICATED: enter a code first");
      const admin = codeSession.admin || String(body.admin ?? "").trim();
      if (!NAME_PATTERN.test(admin) || RESERVED_NAMES.has(admin))
        throw new OsadminError(
          "invalid_argument",
          "ACCESS_ADMIN_NAME: use lower-case letters, digits and dashes, starting with a letter; admin, enrol, root and sneakers are taken",
        );
      if (codeSession.kind === "CODE_KIND_SETUP" && findAdmin(admin))
        throw new OsadminError("already_exists", `ACCESS_ADMIN_EXISTS: ${admin} already exists`);
      const check = passwordCheck(String(body.password ?? ""), admin);
      if (!check.ok)
        throw new OsadminError("invalid_argument", `ACCESS_PASSWORD: ${check.message}`);
      const id = `enrol-${String(enrolments.size + 1)}`;
      enrolments.set(id, { admin, kind: codeSession.kind });
      return { totp: world.totpEnrolment(admin, id) };
    }
    case "SetupService/CheckPassword": {
      return passwordCheck(String(body.password ?? ""), String(body.admin ?? ""));
    }
    case "SetupService/CompleteCredentials": {
      const enrolment = enrolments.get(String(body.enrolmentId ?? ""));
      if (!enrolment || !codeSession)
        throw new OsadminError(
          "failed_precondition",
          "ACCESS_ENROLMENT: start again from the code",
        );
      const code = String(body.totpCode ?? "");
      if (!/^\d{6}$/.test(code) || code === world.MOCK_WRONG_CODE)
        throw refused("ACCESS_TOTP: the code doesn't match the new authenticator", {
          attemptsLeft: 2,
        });
      let admin = findAdmin(enrolment.admin);
      if (!admin) {
        admin = {
          created: new Date().toISOString(),
          createdBy: enrolment.kind === "CODE_KIND_SETUP" ? "console" : "invitation",
          keys: [],
          name: enrolment.admin,
          role: enrolment.kind === "CODE_KIND_INVITE" ? "ROLE_ADMIN" : "ROLE_OWNER",
          uid: 20_000 + admins.length,
        };
        admins.push(admin);
      }
      admin.credentialsSet = true;
      admin.inviteExpires = undefined;
      admin.passwordChanged = new Date().toISOString();
      admin.totpAdded = new Date().toISOString();
      if (enrolment.kind === "CODE_KIND_SETUP")
        quorum = { configured: true, members: [admin.name], required: 1 };
      for (const [code, name] of invitations) if (name === admin.name) invitations.delete(code);
      enrolments.clear();
      codeSession = null;
      cookieSession = sessionOf(admin);
      return { session: cookieSession };
    }
    case "SetupService/DownloadEscrow": {
      return { content: btoa("mock-escrow-ciphertext"), fileName: "escrow-20261007.age" };
    }
    case "SetupService/Finish": {
      const open = setupSteps().steps.find((step) => !step.done && step.number < 6);
      if (open)
        throw new OsadminError(
          "failed_precondition",
          `SETUP_INCOMPLETE: step ${String(open.number)} isn't done`,
        );
      if (!signedInOnce)
        throw new OsadminError(
          "failed_precondition",
          "SETUP_INCOMPLETE: sign in once with the password and a code",
        );
      if (admins.length === 1 && !singleAdminAcknowledged)
        throw new OsadminError(
          "failed_precondition",
          "SETUP_INCOMPLETE: confirm the single-admin warning",
        );
      setupDone = true;
      // The box restarts into normal operation after Finish.
      restart();
      return { productSetupUrl: "https://sneakers.example.org/setup" };
    }
    case "SetupService/GenerateRecoveryKey": {
      if (recoveryKeys.length >= 3)
        throw new OsadminError("invalid_argument", "ACCESS_RECOVERY_KEY_LIMIT");
      const set = new Date().toISOString();
      const key = {
        fingerprint: `SHA256:mockGenerated${recoveryKeys.length}`,
        label: String(body.label ?? "").trim(),
        set,
        setBy: caller() || "alice",
        type: "ssh-ed25519",
      };
      recoveryKeys.push(key);
      return {
        fileName: `sneakers-recovery-${set.replaceAll(/[-:]|\.\d+/g, "")}`,
        privateKey: [
          "-----BEGIN OPENSSH PRIVATE KEY-----", // gitleaks:allow (a placeholder, not a key)
          "MOCK-RECOVERY-KEY-NOT-A-REAL-KEY-MOCK-RECOVERY-KEY-NOT-A-REAL-KEY",
          "-----END OPENSSH PRIVATE KEY-----",
          "",
        ].join("\n"),
        publicKey: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIMOCKRECOVERYKEYNOTAREALKEY",
        recoveryKey: key,
      };
    }
    case "SetupService/GetSetup": {
      if (!getSession() && !cookieSession && !codeSession)
        throw new OsadminError(
          "unauthenticated",
          "ACCESS_UNAUTHENTICATED: sign in or enter a code",
        );
      const { current, steps } = setupSteps();
      return {
        adminCount: admins.length,
        codeAdmin: codeSession?.admin ?? "",
        codeKind: codeSession?.kind,
        current,
        done: setupDone,
        escrowFile: recoveryKeys.length > 0 ? "escrow-20261007.age" : "",
        firstAdmin: admins[0]?.name ?? "",
        maxRecoveryKeys: 3,
        productSetupUrl: "https://sneakers.example.org/setup",
        recoveryKeys,
        signedIn: signedInOnce,
        singleAdminAcknowledged,
        singleAdminWarning: admins.length === 1,
        steps,
      };
    }
    case "SetupService/RedeemCode": {
      const code = normalCode(String(body.code ?? ""));
      const invited = invitations.get(code);
      if (invited) {
        codeSession = { admin: invited, kind: "CODE_KIND_INVITE" };
        return {
          admin: invited,
          csrfToken: "mock-code-csrf",
          expires: new Date(Date.now() + 24 * 3_600_000).toISOString(),
          kind: codeSession.kind,
        };
      }
      if (!setupDone && admins.length === 0 && code === normalCode(world.MOCK_SETUP_CODE)) {
        codeSession = { admin: "", kind: "CODE_KIND_SETUP" };
        return {
          csrfToken: "mock-code-csrf",
          expires: new Date(Date.now() + 60 * 60_000).toISOString(),
          kind: codeSession.kind,
        };
      }
      codeTries = Math.max(0, codeTries - 1);
      throw refused("SETUP_CODE: the code is wrong or used up", { attemptsLeft: codeTries });
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
    case "SetupService/RemoveRecoveryKey": {
      if (recoveryKeys.length <= 1)
        throw new OsadminError("invalid_argument", "ACCESS_LAST_RECOVERY_KEY");
      const index = recoveryKeys.findIndex((k) => k.fingerprint === body.fingerprint);
      if (index !== -1) recoveryKeys.splice(index, 1);
      return {};
    }
    case "SignInService/GetSession": {
      advanceProgress();
      if (restartingUntil) {
        if (Date.now() < restartingUntil)
          throw new OsadminError("unavailable", "The appliance didn't answer.");
        restartingUntil = 0;
        cookieSession = null;
      }
      return { session: cookieSession ?? undefined };
    }
    case "SignInService/SignIn": {
      const name = String(body.admin ?? "").trim();
      checkCredentials(name, String(body.password ?? ""), String(body.totpCode ?? ""));
      const admin = findAdmin(name);
      if (!admin) throw notFound("no admin");
      cookieSession = sessionOf(admin);
      signedInOnce = true;
      return { session: cookieSession };
    }
    case "SignInService/SignOut": {
      cookieSession = null;
      return {};
    }
    case "SignInService/StepUp": {
      const current = getSession();
      if (!current)
        throw new OsadminError("unauthenticated", "ACCESS_UNAUTHENTICATED: sign in first");
      checkCredentials(current.admin, null, String(body.totpCode ?? ""));
      const session = { ...current, stepUpUntil: new Date(Date.now() + 5 * 60_000).toISOString() };
      cookieSession = session;
      return { session };
    }
    case "StatusService/GetPhase": {
      if (restartingUntil && Date.now() < restartingUntil)
        throw new OsadminError("unavailable", "The appliance didn't answer.");
      advanceProgress();
      return { phase: setupDone ? "normal" : "firstboot", upgradeProgress: publicProgress() };
    }
    case "StatusService/GetStatus": {
      if (statusFails)
        throw new OsadminError(
          "unavailable",
          "the appliance services are unavailable; try again shortly",
        );
      powerState();
      return {
        ...world.status(),
        custodyMode,
        factoryReset: structuredClone(factoryReset),
        failedVersion,
        ...reverted,
        protection:
          secureBootOn && custodyMode === "tpm" ? "PROTECTION_FULL" : "PROTECTION_REDUCED",
        protectionReason:
          secureBootOn && custodyMode === "tpm"
            ? ""
            : "Secure Boot isn't available on this hardware, and there is no TPM",
        ...previousSlot(),
        runningVersion,
        stagedVersion,
        upgradeProgress: structuredClone(upgradeProgress),
      };
    }
    case "StatusService/SetSecureBoot": {
      secureBootOn = body.on as boolean;
      return {};
    }
    case "UpgradeService/ApplyUpdate": {
      checkCallCode(body.totpCode);
      if (isProduct(body.target)) {
        if (!product.stagedVersion)
          throw new OsadminError("failed_precondition", "UPGRADE_NOT_STAGED: no product is staged");
        const detail = holdForElevation(
          "product installs",
          body.elevationOverride as ElevationOverride | undefined,
        );
        historyEntry("apply", product.stagedVersion, "", detail, "UPDATE_TARGET_PRODUCT");
        restartProduct("apply", product.stagedVersion);
        product = {
          installedVersion: product.stagedVersion,
          name: world.PRODUCT_SLOTS.name,
          previousVersion: product.installedVersion,
          running: false,
          stagedVersion: "",
        };
        return {};
      }
      if (!stagedVersion)
        throw new OsadminError("failed_precondition", "UPGRADE_NOT_STAGED: no release is staged");
      const detail = holdForElevation(
        "update applies",
        body.elevationOverride as ElevationOverride | undefined,
      );
      historyEntry("apply", stagedVersion, "", detail);
      upgradeProgress = progressAt(
        "apply",
        "UPDATE_TARGET_BASE",
        stagedVersion,
        "reboot",
        "ACTIVE",
        {
          detail: `The box restarts into ${stagedVersion}.`,
        },
      );
      previousVersion = runningVersion;
      runningVersion = stagedVersion;
      stagedVersion = "";
      reverted = null;
      restart();
      return {};
    }
    case "UpgradeService/DiscardUpdate": {
      const uploadId = (body.uploadId as string | undefined) ?? "";
      if (uploadId) {
        if (!uploads.has(uploadId))
          throw new OsadminError(
            "failed_precondition",
            `UPGRADE_UPLOAD: there is no upload ${uploadId}`,
          );
        dropUpload(uploadId);
        historyEntry("discard", "", "", `upload ${uploadId}`);
        return {};
      }
      const notStaged = () =>
        new OsadminError("failed_precondition", "UPGRADE_NOT_STAGED: no release is staged");
      if (isProduct(body.target)) {
        const version = product.stagedVersion;
        if (!version) throw notStaged();
        product = { ...product, stagedVersion: "" };
        historyEntry("discard", version, "", "unstaged", "UPDATE_TARGET_PRODUCT");
        return { version };
      }
      const version = stagedVersion;
      if (!version) throw notStaged();
      stagedVersion = "";
      historyEntry("discard", version, "", "unstaged");
      return { version };
    }
    case "UpgradeService/FetchUpdate": {
      if (isAirGapped())
        throw new OsadminError(
          "failed_precondition",
          "UPGRADE_AIR_GAPPED: no mirror is configured, so this box never fetches; upload the .bin instead",
        );
      checkNotBusy();
      const fileName = body.fileName as string;
      fromMirror();
      const productFile = /^sneakers-product-(\d+\.\d+\.\d+)-(amd64|arm64)\.bin$/.exec(fileName);
      if (productFile) {
        const uploadId = `fetch-${String(++uploadCount)}`;
        holdUpload(
          uploadId,
          new Blob([`signed product ${productFile[1] ?? ""}`]),
          fileName,
          upgradePolicy.mirrorUrl ? "mirror" : "direct",
        );
        historyEntry("fetch", productFile[1] ?? "", "", "", "UPDATE_TARGET_PRODUCT");
        return { source: upgradePolicy.mirrorUrl ? "mirror" : "direct", uploadId };
      }
      if (!/^sneakers-appliance-\d+\.\d+\.\d+(-[\w.]+)?-(amd64|arm64)\.bin$/.test(fileName))
        throw new OsadminError(
          "failed_precondition",
          `UPGRADE_UPLOAD: "${fileName}" isn't a sneakers-appliance .bin name`,
        );
      const uploadId = `fetch-${String(++uploadCount)}`;
      holdUpload(
        uploadId,
        new Blob([fileName.includes("0.1.1") ? "signed patch" : "signed release"]),
        fileName,
        "mirror",
      );
      historyEntry("fetch", "");
      return { uploadId };
    }
    case "UpgradeService/GetUpgrades": {
      advanceProgress();
      advanceProductRestart();
      return {
        activeElevations: structuredClone(elevations.filter((item) => item.state === "active")),
        airGapped: isAirGapped(),
        directAvailable: DIRECT_AVAILABLE,
        failedVersion,
        heldUpload: heldUpload(),
        ...reverted,
        history: structuredClone(upgradeHistory),
        mirrorStatus: mirrorStatus(upgradePolicy.mirrorUrl),
        // As on the box: staging writes over the other slot, so it removes what's there.
        nextStageRemoves: [stagedVersion || previousVersion].filter(Boolean),
        policy: structuredClone(upgradePolicy),
        ...previousSlot(),
        product: structuredClone(product),
        receiving: receiving || noticeCancel(),
        runningVersion,
        stagedVersion,
        upgradeProgress: structuredClone(upgradeProgress),
      };
    }
    case "UpgradeService/ListProductVersions": {
      if (isAirGapped())
        throw new OsadminError(
          "failed_precondition",
          "UPGRADE_AIR_GAPPED: no mirror or release source is set; upload the product bundle instead",
        );
      fromMirror();
      const versions = world.PRODUCT_VERSIONS.filter(
        (v) =>
          (v.minBase
            ? inRange(runningVersion, v.minBase, v.maxBase)
            : v.bases.includes(runningVersion)) &&
          (!product.installedVersion || newer(v.version, product.installedVersion)),
      ).map((v) => ({ ...v, source: upgradePolicy.mirrorUrl ? "mirror" : "direct" }));
      return { baseVersion: runningVersion, versions };
    }
    case "UpgradeService/RevertUpdate": {
      checkCallCode(body.totpCode);
      if (isProduct(body.target)) {
        if (!product.previousVersion)
          throw new OsadminError(
            "failed_precondition",
            "UPGRADE_NO_PREVIOUS: there is no previous product slot to go back to",
          );
        const detail = holdForElevation(
          "product reverts",
          body.elevationOverride as ElevationOverride | undefined,
        );
        historyEntry("revert", product.previousVersion, "", detail, "UPDATE_TARGET_PRODUCT");
        restartProduct("revert", product.previousVersion);
        product = {
          installedVersion: product.previousVersion,
          name: product.name,
          previousVersion: product.installedVersion,
          running: false,
          stagedVersion: "",
        };
        return {};
      }
      if (!previousVersion)
        throw new OsadminError(
          "failed_precondition",
          "UPGRADE_NO_PREVIOUS: there's no previous release to roll back to",
        );
      const detail = holdForElevation(
        "update reverts",
        body.elevationOverride as ElevationOverride | undefined,
      );
      historyEntry("revert", "", "", detail);
      upgradeProgress = progressAt(
        "revert",
        "UPDATE_TARGET_BASE",
        previousVersion,
        "reboot",
        "ACTIVE",
        {
          detail: `The box restarts into ${previousVersion}.`,
        },
      );
      reverted = {
        revertedAt: new Date().toISOString(),
        revertedBy: caller(),
        revertedVersion: runningVersion,
      };
      runningVersion = previousVersion;
      previousVersion = "";
      restart();
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
      if (verifyStalls) {
        upgradeProgress = progressAt("stage", "UPDATE_TARGET_BASE", "0.2.0", "stage", "ACTIVE", {
          detail: "Writing the release into slot B.",
          doneBytes: String(512 * 2 ** 20),
          totalBytes: String(2 ** 30),
        });
        return never();
      }
      const uploadId = body.uploadId as string;
      try {
        const updatePackage = await verify(uploadId);
        upgradeProgress = progressAt(
          "stage",
          updatePackage.target ?? "UPDATE_TARGET_BASE",
          updatePackage.version,
          "stage",
          "DONE",
        );
        dropUpload(uploadId);
        if (isProduct(updatePackage.target)) product.stagedVersion = updatePackage.version;
        else {
          stagedVersion = updatePackage.version;
          previousVersion = "";
        }
        historyEntry("stage", updatePackage.version, "", "", updatePackage.target);
        return isProduct(updatePackage.target)
          ? { package: updatePackage }
          : { package: updatePackage, slot: "B" };
      } catch (error) {
        const code = error instanceof OsadminError ? (error.symbol ?? "") : "";
        historyEntry("stage", "", code);
        upgradeProgress = progressAt("stage", "UPDATE_TARGET_BASE", "", "verify", "FAILED", {
          code,
          detail: error instanceof Error ? error.message : "",
        });
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
      return admin ? sessionOf(admin) : null;
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
    options: UploadOptions = {},
  ): Promise<{ uploadId: string }> {
    checkNotBusy();
    receiving = true;
    onProgress?.(0.4);
    if (uploadStalls || options.signal?.aborted) {
      // A stalled upload ends only when the page cancels it; the box drops what it got.
      await new Promise<never>((_, reject) => {
        const cancel = () => {
          receiving = false;
          receivingAfterCancel = 1;
          reject(new OsadminError("cancelled", UPLOAD_CANCELLED, "UPLOAD_CANCELLED"));
        };
        if (options.signal?.aborted) cancel();
        options.signal?.addEventListener("abort", cancel);
      });
    }
    receiving = false;
    const uploadId = `upload-${String(++uploadCount)}`;
    holdUpload(uploadId, bytes, options.fileName ?? "", "upload");
    onProgress?.(1);
    return { uploadId };
  },
};

const refill = <T>(target: T[], source: readonly T[]) => {
  target.splice(0, target.length, ...structuredClone(source));
};

const MOCK_SCENARIOS = [
  "air-gapped",
  "elevated",
  "failed",
  "first-boot",
  "held",
  "invited",
  "locked",
  "locked-until-unlocked",
  "manual",
  "no-previous",
  "no-product",
  "product-range",
  "product-restart-fails",
  "product-staged",
  "reduced",
  "reset-countdown",
  "reset-pending",
  "reverted",
  "setup-admin",
  "setup-finish",
  "setup-keys",
  "setup-network",
  "setup-protection",
  "signed-in",
  "single-admin",
  "status-fails",
  "staged",
  "stepup",
  "throttled",
  "uploading",
  "verifying",
] as const;

export type MockScenario = (typeof MOCK_SCENARIOS)[number] | CertificateScenario | MirrorScenario;

/** A fresh box: no admin, no recovery key, setup not started. */
const firstBoot = () => {
  admins.splice(0);
  recoveryKeys.splice(0);
  quorum = { configured: false, members: [], required: 0 };
  setupDone = false;
  signedInOnce = false;
  singleAdminAcknowledged = false;
  networkSeen = false;
  protectionSeen = false;
};

const SETUP_ORDER = [
  "setup-admin",
  "setup-keys",
  "setup-network",
  "setup-protection",
  "setup-finish",
];

/**
 * A box part-way through setup, as a reload finds it: the code redeemed (setup-admin), then
 * alice created and signed in by her cookie (setup-keys), with a recovery key (setup-network),
 * the network seen (setup-protection) and the protection seen (setup-finish).
 */
const setupAt = (scenario: string) => {
  firstBoot();
  const reached = SETUP_ORDER.indexOf(scenario);
  if (reached === 0) {
    codeSession = { admin: "", kind: "CODE_KIND_SETUP" };
    return;
  }
  const alice = { ...structuredClone(world.ADMINS[0]!), keys: [] };
  admins.push(alice);
  quorum = { configured: true, members: ["alice"], required: 1 };
  cookieSession = sessionOf(alice);
  if (reached >= 2) recoveryKeys.push(structuredClone(world.RECOVERY_KEYS[0]!));
  if (reached >= 3) networkSeen = true;
  if (reached >= 4) protectionSeen = true;
};

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
  if ((CERTIFICATE_SCENARIOS as string[]).includes(scenario)) {
    applyCertificateScenario(scenario as CertificateScenario);
    return;
  }
  if ((MIRROR_SCENARIOS as string[]).includes(scenario)) {
    upgradePolicy = {
      ...upgradePolicy,
      direct: false,
      mirrorUrl: applyMirrorScenario(scenario as MirrorScenario),
    };
    return;
  }
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
      previousVersion = "";
      break;
    }
    case "first-boot": {
      firstBoot();
      break;
    }
    case "held": {
      holdUpload(
        "upload-held",
        new Blob(["signed release"]),
        "sneakers-appliance-0.2.0-amd64.bin",
        "upload",
      );
      break;
    }
    case "invited": {
      if (!findAdmin("carol"))
        admins.push({
          created: new Date().toISOString(),
          createdBy: "alice",
          keys: [],
          name: "carol",
          role: "ROLE_ADMIN",
          uid: 20_002,
        });
      invitations.set(normalCode(world.MOCK_INVITE_CODE), "carol");
      break;
    }
    case "locked": {
      locks.set("bob", {
        until: new Date(Date.now() + 12 * 60_000).toISOString(),
        untilUnlocked: false,
      });
      break;
    }
    case "locked-until-unlocked": {
      locks.set("bob", { untilUnlocked: true });
      break;
    }
    case "manual": {
      upgradePolicy = { ...upgradePolicy, mode: "manual" };
      break;
    }
    case "no-previous": {
      previousVersion = "";
      break;
    }
    case "no-product": {
      product = {
        installedVersion: "",
        name: "",
        previousVersion: "",
        running: false,
        stagedVersion: "",
      };
      break;
    }
    case "product-range": {
      holdUpload(
        "upload-range",
        new Blob(["signed product 0.4.0 needs 9.0.0"]),
        "sneakers-product-0.4.0-amd64.bin",
        "upload",
      );
      break;
    }
    case "product-restart-fails": {
      productRestartFails = true;
      break;
    }
    case "product-staged": {
      product = { ...product, previousVersion: "0.0.9", stagedVersion: "0.2.0" };
      break;
    }
    case "reduced": {
      secureBootOn = false;
      custodyMode = "keyfile";
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
    case "reverted": {
      previousVersion = "";
      reverted = {
        revertedAt: "2026-10-08T14:05:00Z",
        revertedBy: "alice",
        revertedVersion: "0.2.0",
      };
      break;
    }
    case "setup-admin":
    case "setup-finish":
    case "setup-keys":
    case "setup-network":
    case "setup-protection": {
      setupAt(scenario);
      break;
    }
    case "signed-in": {
      const alice = findAdmin("alice");
      if (alice) cookieSession = sessionOf(alice);
      break;
    }
    case "single-admin": {
      admins.splice(1);
      quorum = { configured: false, members: ["alice"], required: 1 };
      break;
    }
    case "staged": {
      stagedVersion = "0.2.0";
      previousVersion = "";
      break;
    }
    case "status-fails": {
      statusFails = true;
      break;
    }
    case "stepup": {
      stepUpOnce = true;
      break;
    }
    case "throttled": {
      throttledUntil = new Date(Date.now() + 4 * 60_000).toISOString();
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
  ...CERTIFICATE_SCENARIOS,
  ...MIRROR_SCENARIOS,
  ...MOCK_SCENARIOS,
]);

/** `?mockScenario=staged,reset-pending` on a mock build's URL, for the review screen list. */
const scenariosFromUrl = (): void => {
  const search = globalThis.location?.search ?? "";
  const names = new URLSearchParams(search).get("mockScenario")?.split(",") ?? [];
  for (const name of names) if (SCENARIOS.has(name)) applyMockScenario(name as MockScenario);
};

/** Resets every mutable piece of the mock world, so tests don't see another test's writes. */
export const resetMockWorld = (): void => {
  resetCertificates();
  resetMirror();
  upgradePolicy = structuredClone(world.UPGRADE_POLICY);
  runningVersion = "0.1.0";
  stagedVersion = "";
  product = structuredClone(world.PRODUCT_SLOTS);
  failedVersion = "";
  reverted = null;
  previousVersion = PREVIOUS_VERSION;
  restartingUntil = 0;
  upgradeProgress = undefined;
  productRestartPolls = 0;
  productRestartFails = false;
  checkingUntil = 0;
  uploads.clear();
  uploadInfo.clear();
  receiving = false;
  receivingAfterCancel = 0;
  uploadCount = 0;
  uploadStalls = false;
  statusFails = false;
  verifyStalls = false;
  stepUpOnce = false;
  failures.clear();
  locks.clear();
  throttledUntil = "";
  cookieSession = null;
  lockoutMode = "LOCKOUT_MODE_TIMED";
  codeSession = null;
  invitations.clear();
  enrolments.clear();
  codeTries = 5;
  networkSeen = false;
  protectionSeen = false;
  signedInOnce = true;
  custodyMode = "tpm";
  refill(upgradeHistory, world.UPGRADE_HISTORY);
  networkPending = null;
  singleAdminAcknowledged = false;
  setupDone = true;
  secureBootOn = true;
  factoryReset = undefined;
  mcpEnabled = true;
  machineApiEnabled = false;
  quorum = structuredClone(world.QUORUM);
  accessPolicy = structuredClone(world.ACCESS_POLICY);
  keySerial = 100;
  inviteCount = 0;
  networkSettings = structuredClone(world.NETWORK_SETTINGS);
  backupPolicy = structuredClone(world.BACKUP_POLICY);
  refill(modules.available, world.MODULES.available);
  refill(recoveryKeys, world.RECOVERY_KEYS);
  refill(admins, world.ADMINS);
  refill(elevations, world.ELEVATIONS);
  refill(revokedKeys, world.REVOKED_KEYS);
  refill(auditEvents, world.AUDIT_EVENTS);
  refill(backupSets, world.BACKUP_SETS);
};

scenariosFromUrl();
