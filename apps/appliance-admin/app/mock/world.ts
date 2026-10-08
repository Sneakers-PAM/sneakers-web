import type {
  AccessPolicy,
  ActiveSession,
  Admin,
  AuditEvent,
  BackupPolicy,
  BackupSet,
  Elevation,
  FactoryReset,
  GetStatusResponse,
  HostKey,
  Key,
  ListModulesResponse,
  NetdSettings,
  ProductSlots,
  ProductVersion,
  Quorum,
  RecoveryKey,
  RevokedKey,
  Session,
  UpgradeEvent,
  UpgradePolicy,
} from "@/lib/osadmin/types";

const now = () => new Date().toISOString();
const soon = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();

const aliceKey: Key = {
  added: soon(-60 * 24 * 30),
  addedBy: "alice",
  comment: "alice laptop",
  fingerprint: "SHA256:7p5Q2m8h8z8sRkYwQwQEuY7zL5mZ8w5z6c1h9b7qv8w",
  lastUsed: soon(-5),
  serial: "1",
  type: "ssh-ed25519",
  validBefore: soon(60 * 24 * 335),
  via: "issued",
};

const bobKey: Key = {
  added: soon(-60 * 24 * 10),
  addedBy: "alice",
  comment: "bob workstation",
  fingerprint: "SHA256:k2m9Q7h5z1sRkYwQwQEuY7zL5mZ8w5z6c1h9b7qABCD",
  lastUsed: soon(-120),
  serial: "2",
  type: "ssh-ed25519",
  validBefore: soon(60 * 24 * 355),
  via: "issued",
};

export const ADMINS: Admin[] = [
  {
    created: soon(-60 * 24 * 30),
    createdBy: "console",
    credentialsSet: true,
    keys: [aliceKey],
    lastSignIn: soon(-5),
    name: "alice",
    passwordChanged: soon(-60 * 24 * 30),
    role: "ROLE_OWNER",
    totpAdded: soon(-60 * 24 * 30),
    uid: 20_000,
  },
  {
    created: soon(-60 * 24 * 10),
    createdBy: "alice",
    credentialsSet: true,
    keys: [bobKey],
    lastSignIn: soon(-120),
    name: "bob",
    passwordChanged: soon(-60 * 24 * 10),
    role: "ROLE_ADMIN",
    totpAdded: soon(-60 * 24 * 10),
    uid: 20_001,
  },
];

export const HOST_KEYS: HostKey[] = [
  { fingerprint: "SHA256:aK1X8qf9w2v6z4m7h5s1rQwQEuY7zL5mZ8w5z6c1h9", type: "ssh-ed25519" },
  { fingerprint: "SHA256:bR9X8qf9w2v6z4m7h5s1rQwQEuY7zL5mZ8w5z6c1h9", type: "ssh-rsa" },
];

/** The box's root key: it signs the root-shell codes and the SSH certificates. */
export const ROOT_KEY: HostKey = {
  fingerprint: "SHA256:rT9k3Vw7Qm2Xp5Ln8Hc4Zb6Yd1Fs0Ga7Ej2Ku9Wq3Mo",
  type: "ssh-ed25519",
};

export const ACCESS_POLICY: AccessPolicy = {
  lockoutMode: "LOCKOUT_MODE_TIMED",
  rootCodeMinutes: 10,
  rootSessionMinutes: 10,
  sshKeyValidDays: 365,
};

export const QUORUM: Quorum = { configured: true, members: ["alice", "bob"], required: 2 };

export const RECOVERY_KEYS: RecoveryKey[] = [
  {
    fingerprint: "SHA256:rK1X8qf9w2v6z4m7h5s1rQwQEuY7zL5mZ8w5z6c1h9",
    label: "offline safe",
    set: soon(-60 * 24 * 30),
    setBy: "alice",
    type: "ssh-ed25519",
  },
];

export const ELEVATIONS: Elevation[] = [
  {
    admin: "bob",
    approved: soon(-60 * 24 - 3),
    approvedBy: "bob",
    ended: soon(-60 * 24 + 6),
    endReason: "exit",
    id: "E-7K2Q",
    keyFingerprint: bobKey.fingerprint,
    minutes: 10,
    reason: "",
    requested: soon(-60 * 24 - 4),
    sourceAddress: "192.0.2.50",
    started: soon(-60 * 24 - 2),
    state: "ended",
  },
];

/** A key alice removed from bob last week: still on the revocation list. */
export const REVOKED_KEYS: RevokedKey[] = [
  {
    admin: "bob",
    fingerprint: "SHA256:oLd9Q7h5z1sRkYwQwQEuY7zL5mZ8w5z6c1h9b7qOLD",
    revoked: soon(-60 * 24 * 7),
    revokedBy: "alice",
    type: "ssh-ed25519",
  },
];

/** The "elevated" scenario's open root shell: bob's, with its code used. */
export const ACTIVE_ELEVATION: Elevation = {
  admin: "bob",
  approvedBy: "bob",
  id: "E-9M4T",
  keyFingerprint: bobKey.fingerprint,
  minutes: 10,
  reason: "check the kubelet logs",
  requested: soon(-12),
  sourceAddress: "192.0.2.50",
  started: soon(-10),
  state: "active",
};

export const BACKUP_POLICY: BackupPolicy = {
  retentionDays: 30,
  schedule: "02:00",
  targets: ["sftp://backups.example.org/sneakers"],
};

export const BACKUP_SETS: BackupSet[] = [
  { id: "bk-20261006", sizeBytes: "483183820", taken: soon(-60 * 24), target: "sftp" },
  { id: "bk-20261005", sizeBytes: "481022010", taken: soon(-60 * 48), target: "sftp" },
];

export const AUDIT_EVENTS: AuditEvent[] = [
  {
    action: "signin.signout",
    actor: "bob",
    code: "",
    detail: {},
    keyFingerprint: bobKey.fingerprint,
    outcome: "ok",
    sourceAddress: "192.0.2.50",
    target: "",
    time: soon(-30),
  },
  {
    action: "elevation.request",
    actor: "bob",
    code: "",
    detail: { id: "E-7K2Q", reason: "investigate kubelet" },
    keyFingerprint: bobKey.fingerprint,
    outcome: "ok",
    sourceAddress: "192.0.2.50",
    target: "bob's elevated shell",
    time: soon(-4),
  },
  {
    action: "session.end",
    actor: "alice",
    code: "",
    detail: { admin: "bob", kind: "browser", session: "S-1A2B", source: "192.0.2.50" },
    keyFingerprint: "",
    outcome: "ok",
    sourceAddress: "192.0.2.10",
    target: "bob's browser session from 192.0.2.50",
    time: soon(-10),
  },
  {
    action: "tls.certificate.remove",
    actor: "alice",
    code: "",
    detail: { certificate: "c-7f3a9e", names: "*.example.org,example.org" },
    keyFingerprint: "",
    outcome: "ok",
    sourceAddress: "192.0.2.10",
    target: "*.example.org",
    time: soon(-60),
  },
  {
    action: "access.key.add",
    actor: "alice",
    code: "ACCESS_KEY_WEAK",
    detail: { type: "ssh-rsa" },
    keyFingerprint: aliceKey.fingerprint,
    outcome: "refused",
    sourceAddress: "192.0.2.10",
    target: "bob",
    time: soon(-60 * 24),
  },
];

export const MODULES: ListModulesResponse = {
  available: [
    { active: true, name: "sneakers-core-bundle", version: "0.1.0" },
    { active: false, name: "sneakers-syslog-forwarder", version: "0.1.0" },
  ],
  platform: "VMware ESXi",
};

export const NETWORK_SETTINGS: NetdSettings = {
  addresses: [
    { address: "192.0.2.50", family: "ipv4", gateway: "192.0.2.1", mode: "static", prefix: 24 },
    { family: "ipv6", mode: "slaac" },
  ],
  allowList: ["192.0.2.0/24"],
  dns: ["192.0.2.53"],
  hostname: "appliance.example.org",
  managementInterface: "eth0",
  ntp: ["192.0.2.123"],
  searchDomains: ["example.org"],
};

export const status: () => GetStatusResponse = () => ({
  channel: "stable",
  custodyMode: "tpm",
  disk: {
    growthBytesPerDay: 10_485_760,
    path: "/var/lib/sneakers",
    totalBytes: 107_374_182_400,
    usedBytes: 21_474_836_480,
  },
  failedVersion: "",
  health: [
    { detail: "running", name: "accessd", ok: true },
    { detail: "running", name: "netd", ok: true },
    { detail: "running", name: "k0s", ok: true },
  ],
  hostname: "appliance.example.org",
  managementAddresses: ["192.0.2.50"],
  ntpSynced: true,
  phase: "normal",
  previousSlot: "",
  previousVersion: "",
  protection: "PROTECTION_FULL",
  protectionReason: "",
  runningVersion: "0.1.0",
  stagedVersion: "",
  tlsExpires: soon(60 * 24 * 60),
  tlsFingerprint: "SHA256:dK1X8qf9w2v6z4m7h5s1rQwQEuY7zL5mZ8w5z6c1h9",
  tlsSelfSigned: true,
  version: "0.1.0",
  warnings: [
    { detail: "The :8443 certificate is self-signed.", kind: "WARNING_KIND_SELF_SIGNED_TLS" },
  ],
});

/** Every mock admin's password. Any 6-digit code but 000000 passes as their TOTP code. */
export const MOCK_PASSWORD = "correct horse battery staple";
/** The code the mock console shows for first-boot setup, and carol's invitation code. */
export const MOCK_SETUP_CODE = "7PQK-NMS9-XD2A-4KJW";
export const MOCK_INVITE_CODE = "R4WN-8HTE";
/** Passwords the mock's breached-password check refuses. */
export const BREACHED_PASSWORDS = ["password1234", "qwertyuiop123", "123456789012"]; // gitleaks:allow (made-up weak passwords)

/** The authenticator secret every mock enrolment hands out. */
export const TOTP_SECRET = "JBSWY3DPEHPK3PXPGZ4TKNRWMV2X4Y3Q"; // gitleaks:allow (a widely used example secret, not a real one)

export const totpEnrolment = (account: string, id: string) => ({
  account,
  algorithm: "SHA1",
  digits: 6,
  expires: soon(10),
  id,
  issuer: "Sneakers-PAM appliance",
  periodSeconds: 30,
  secret: TOTP_SECRET,
  uri: `otpauth://totp/Sneakers-PAM%20appliance:${encodeURIComponent(account)}?secret=${TOTP_SECRET}&issuer=Sneakers-PAM%20appliance&algorithm=SHA1&digits=6&period=30`,
});
export const MOCK_WRONG_CODE = "000000";

export const sessionFor = (admin: Admin, rootOperator = false): Session => ({
  admin: admin.name,
  csrfToken: `mock-csrf-${admin.name}`,
  expires: soon(8 * 60),
  idleExpires: soon(15),
  role: admin.role,
  rootOperator,
  signedIn: now(),
  stepUpUntil: soon(5),
});

export const FACTORY_RESET: FactoryReset | undefined = undefined;

export const HOSTNAME = "appliance.example.org";

/** Every live session: GetPower's graceful-shutdown warning and ListSessions/EndSession. */
export const SESSIONS: ActiveSession[] = [
  {
    admin: "alice",
    id: "S-1A2B",
    kind: "SESSION_KIND_BROWSER",
    signedIn: now(),
    sourceAddress: "192.0.2.10",
  },
  {
    admin: "bob",
    id: "S-3C4D",
    kind: "SESSION_KIND_SSH",
    signedIn: soon(-30),
    sourceAddress: "192.0.2.11",
  },
];

/** The mock box runs product 0.1.0, with nothing staged and no previous slot. */
export const PRODUCT_SLOTS: ProductSlots = {
  installedVersion: "0.1.0",
  previousVersion: "",
  running: true,
  stagedVersion: "",
};

/** The release index's stable product bundles, newest first; 0.3.0 needs base 0.2.0. */
export const PRODUCT_VERSIONS: ProductVersion[] = ["0.3.0", "0.2.0", "0.1.1", "0.1.0"].map(
  (version) => ({
    arch: "amd64",
    bases: version === "0.3.0" ? ["0.2.0"] : ["0.1.0"],
    channel: "stable",
    fileName: `sneakers-product-${version}-amd64.bin`,
    size: "734003200",
    source: "mirror",
    version,
  }),
);

export const UPGRADE_POLICY: UpgradePolicy = {
  direct: false,
  mirrorUrl: "https://mirror.example.org/sneakers-appliance",
  mode: "automatic",
  windowMinutes: 120,
  windowStart: "02:00",
};

export const UPGRADE_HISTORY: UpgradeEvent[] = [
  {
    action: "apply",
    actor: "alice",
    code: "",
    detail: "",
    outcome: "ok",
    time: soon(-60 * 24 * 7),
    version: "0.1.0",
  },
  {
    action: "stage",
    actor: "alice",
    code: "UPGRADE_CHANNEL",
    detail: "",
    outcome: "failed",
    time: soon(-60 * 24 * 8),
    version: "0.1.0-lab.3",
  },
];
