import type {
  AccessPolicy,
  ActiveSession,
  Admin,
  AuditEvent,
  BackupPolicy,
  BackupSet,
  Elevation,
  ExposedValue,
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
  Volume,
  Warning,
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

/** The root key's public half: the user CA sshd trusts, which signs every issued key. */
export const USER_CA_PUBLIC_KEY =
  "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIMOCKUSERCANOTAREALKEYMOCKUSERCANOTAREALKEY sneakers-user-ca";

/** The box's SSH host CA, which signs sshd's host certificate. */
export const HOST_CA: HostKey = {
  fingerprint: "SHA256:hC4k3Vw7Qm2Xp5Ln8Hc4Zb6Yd1Fs0Ga7Ej2Ku9Wq3Mo",
  type: "ssh-ed25519",
};

/** The known_hosts line that trusts the host CA for the box's name and management address. */
export const KNOWN_HOSTS =
  "@cert-authority appliance.example.org,192.0.2.50 ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIMOCKHOSTCANOTAREALKEYMOCKHOSTCANOTAREALKEY";

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
  {
    // The client sent the issued key without its certificate; sshd refuses it before any
    // login happens. sneakers-appliance#217.
    action: "ssh.login",
    actor: "bob",
    code: "ACCESS_KEY_NO_CERTIFICATE",
    detail: { sshSource: "192.0.2.50" },
    keyFingerprint: bobKey.fingerprint,
    outcome: "refused",
    sourceAddress: "192.0.2.50",
    target: "bob",
    time: soon(-15),
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

const GIB = 1_073_741_824;
const STATE_TOTAL = 100 * GIB;

/** The box's volumes with the state volume pct full (product data is on it). */
export const fullVolumes = (pct: number): Volume[] => {
  const used = Math.round((STATE_TOTAL * pct) / 100);
  const level =
    pct >= 90 ? "DISK_LEVEL_CRITICAL" : pct >= 80 ? "DISK_LEVEL_WARNING" : "DISK_LEVEL_OK";
  return [
    {
      label: "State",
      level,
      ...(level !== "DISK_LEVEL_OK" && { levelSince: soon(-12) }),
      name: "state",
      path: "/var/lib/sneakers",
      percent: pct,
      sharedWith: "",
      totalBytes: STATE_TOTAL,
      usedBytes: used,
    },
    {
      label: "Product data",
      level: "DISK_LEVEL_UNSPECIFIED",
      name: "data",
      path: "/var/lib/sneakers-data",
      percent: pct,
      sharedWith: "state",
      totalBytes: STATE_TOTAL,
      usedBytes: used,
    },
    {
      label: "Backup",
      level: "DISK_LEVEL_OK",
      name: "backup",
      path: "/var/lib/sneakers/backup",
      percent: 31,
      sharedWith: "",
      totalBytes: 40 * GIB,
      usedBytes: Math.round(40 * GIB * 0.31),
    },
  ];
};

/** What the mock's cleanup frees from a box full of removable files. */
export const DISK_JUNK_BYTES = 60 * GIB;

/** The disk guard's warnings for a disk scenario. */
export const diskWarnings = (state: "critical" | "stuck" | "warning"): Warning[] => {
  if (state === "warning")
    return [
      {
        detail:
          "The state volume is 85% full (85.0 GiB of 100.0 GiB). The box cleans up on its own every hour; if it stays this full, grow the disk.",
        kind: "WARNING_KIND_DISK_SPACE",
      },
      {
        detail:
          "The state volume grew 6.0 GiB in the last day; at that rate it fills in about 2 days.",
        kind: "WARNING_KIND_DISK_GROWTH",
      },
    ];
  const out: Warning[] = [
    {
      critical: true,
      detail:
        "The state volume is 93% full (93.0 GiB of 100.0 GiB). The box has cleaned up what it may; writes will soon fail. Free space or grow the disk now.",
      kind: "WARNING_KIND_DISK_SPACE",
    },
  ];
  if (state === "stuck")
    out.push({
      detail:
        "The database's write-ahead log is 1.4 GiB, over its 1.0 GiB limit. The database keeps it in check through its own settings; one that keeps growing means its checkpoints or its archiving are stuck.",
      kind: "WARNING_KIND_DATA_WAL",
    });
  return out;
};

export const status: () => GetStatusResponse = () => ({
  channel: "stable",
  custodyMode: "tpm",
  dataPaths: [
    {
      growthBytesPerDay: 52_428_800,
      label: "The database",
      name: "database",
      sizeBytes: 3 * GIB,
      walBytes: 201_326_592,
      walWarnBytes: GIB,
    },
  ],
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
  volumes: fullVolumes(20),
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
/** The mock product's one-time setup token, an exposed value (ProductService). */
export const MOCK_SETUP_TOKEN = "MOCK-SETUP-TOKEN-7Q2K-NOT-A-REAL-ONE";

/** What the mock product's product.yaml exposes. */
export const EXPOSED_VALUES: ExposedValue[] = [
  {
    consumed: false,
    label: "Sneakers setup token",
    link: "https://appliance.example.org/admin/setup",
    name: "setup-token",
    oneTime: true,
    roles: ["ROLE_OWNER", "ROLE_ADMIN"],
  },
];

export const PRODUCT_SLOTS: ProductSlots = {
  installedVersion: "0.1.0",
  name: "Sneakers",
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
    maxBase: version === "0.3.0" ? "" : "0.1.9",
    minBase: version === "0.3.0" ? "0.2.0" : "0.1.0",
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
