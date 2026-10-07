import type {
  Admin,
  AuditEvent,
  BackupPolicy,
  BackupSet,
  Certificate,
  Elevation,
  ElevationPolicy,
  FactoryReset,
  GetStatusResponse,
  HostKey,
  Key,
  ListModulesResponse,
  NetdSettings,
  Quorum,
  RecoveryKey,
  Session,
} from "@/lib/osadmin/types";

const now = () => new Date().toISOString();
const soon = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();

const aliceKey: Key = {
  added: soon(-60 * 24 * 30),
  addedBy: "alice",
  comment: "alice laptop",
  fingerprint: "SHA256:7p5Q2m8h8z8sRkYwQwQEuY7zL5mZ8w5z6c1h9b7qv8w",
  lastUsed: soon(-5),
  type: "ssh-ed25519",
  via: "enrol",
};

const bobKey: Key = {
  added: soon(-60 * 24 * 10),
  addedBy: "alice",
  comment: "bob workstation",
  fingerprint: "SHA256:k2m9Q7h5z1sRkYwQwQEuY7zL5mZ8w5z6c1h9b7qABCD",
  lastUsed: soon(-120),
  type: "ssh-ed25519",
  via: "shell",
};

export const ADMINS: Admin[] = [
  {
    created: soon(-60 * 24 * 30),
    createdBy: "console",
    keys: [aliceKey],
    name: "alice",
    role: "ROLE_OWNER",
    uid: 20_000,
  },
  {
    created: soon(-60 * 24 * 10),
    createdBy: "alice",
    keys: [bobKey],
    name: "bob",
    role: "ROLE_ADMIN",
    uid: 20_001,
  },
];

export const HOST_KEYS: HostKey[] = [
  { fingerprint: "SHA256:aK1X8qf9w2v6z4m7h5s1rQwQEuY7zL5mZ8w5z6c1h9", type: "ssh-ed25519" },
  { fingerprint: "SHA256:bR9X8qf9w2v6z4m7h5s1rQwQEuY7zL5mZ8w5z6c1h9", type: "ssh-rsa" },
];

export const ELEVATION_POLICY: ElevationPolicy = {
  defaultMinutes: 60,
  maxMinutes: 240,
  selfApprovalWhenSingleOwner: true,
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
    id: "E-7K2Q",
    keyFingerprint: bobKey.fingerprint,
    minutes: 30,
    reason: "investigate kubelet",
    requested: soon(-4),
    sourceAddress: "192.0.2.50",
    state: "pending",
  },
];

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
    detail: { reason: "investigate kubelet" },
    keyFingerprint: bobKey.fingerprint,
    outcome: "ok",
    sourceAddress: "192.0.2.50",
    target: "E-7K2Q",
    time: soon(-4),
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

export const PRODUCT_CERT: Certificate = {
  expires: soon(60 * 24 * 60),
  fingerprint: "SHA256:cK1X8qf9w2v6z4m7h5s1rQwQEuY7zL5mZ8w5z6c1h9",
  issuer: "appliance.example.org",
  names: ["appliance.example.org"],
  subject: "appliance.example.org",
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

export const sessionFor = (admin: Admin): Session => ({
  admin: admin.name,
  csrfToken: `mock-csrf-${admin.name}`,
  expires: soon(8 * 60),
  idleExpires: soon(15),
  keyFingerprint: admin.keys[0]?.fingerprint ?? "",
  role: admin.role,
  signedIn: now(),
  stepUpUntil: soon(5),
});

export const FACTORY_RESET: FactoryReset | undefined = undefined;
