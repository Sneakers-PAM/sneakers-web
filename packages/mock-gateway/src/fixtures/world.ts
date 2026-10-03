/*
 * The invented organisation the staff and admin screens run against in mock mode: folders, secrets,
 * targets, checkouts, requests and agent access. Everything here is made up. Ids start with
 * "mock-", hosts live under example.org or 192.0.2.0/24, and no value is a real credential.
 * Times are relative to when the world is built, so "expires in 5 days" stays true.
 */

export type FieldKind =
  "boolean" | "file" | "multiline" | "password" | "select" | "sensitive" | "text";

export interface MockComment {
  authorName: string;
  authorUserId: string;
  body: string;
  createdAt: string;
  id: string;
}

export interface MockConnection {
  description?: string;
  id: string;
  name: string;
  port?: number;
  protocol: string;
  useTls?: boolean;
}

export interface MockFieldDefinition {
  /** The option a select field starts on. */
  defaultValue?: string;
  key: string;
  kind: FieldKind;
  label: string;
  maxLength?: number;
  options?: string[];
  /** A regular expression the value must match. */
  pattern?: string;
  /** For a password field: "strict" makes a typed value pass the policy too. */
  policyEnforcement?: "lax" | "strict";
  /** For a password field: the policy that generates (and with "strict", checks) it. */
  policyId?: string;
  required?: boolean;
  rotates?: boolean;
  sensitive?: boolean;
  superSensitive?: boolean;
}

export interface MockFolder {
  groupId?: string;
  id: string;
  isMasterPersonal?: boolean;
  name: string;
  order: number;
  /** The users who own the folder, so can manage it and its rules. */
  owners: string[];
  ownerUserId?: string;
  parentId?: string;
  role?: string;
  scope: "group" | "personal" | "role";
}

/** A group in identity's directory. Folder rules and the admin console name groups. */
export interface MockGroup {
  id: string;
  name: string;
}

export interface MockLease {
  expiresAt: string;
  id: string;
  issuedAt: string;
  returned: boolean;
  secretId: string;
  userId: string;
}

export interface MockRequest {
  comments: MockComment[];
  destParentId: string;
  destParentName: string;
  folderId: string;
  folderName: string;
  id: string;
  kind: "folder_move" | "secret_access" | "secret_move";
  reason?: string;
  requestedAt: string;
  requestedByUserId: string;
  resolvedAt?: string;
  resolvedByUserId?: string;
  resolvedByUserName?: string;
  secretId: string;
  status: "approved" | "denied" | "pending";
}

export interface MockSecret {
  expiresAt?: string;
  /** Every field value, sensitive ones included. Screens get sensitive values only by reveal. */
  fields: Record<string, string>;
  folderId: string;
  heartbeatOptOut: boolean;
  id: string;
  lastAccessedAt?: string;
  lastHeartbeatResult?: "failed" | "ok" | "unknown" | "unreachable";
  lastRotationResult?: "degraded" | "failed" | "ok" | "rotating" | "unknown";
  name: string;
  nextRotationAt?: string;
  requireTokenApproval: boolean;
  retired: boolean;
  retiredAt: string;
  rotatedAt?: string;
  rotationIntervalDays?: number;
  rotationOptOut: boolean;
  targetId?: string;
  typeId: string;
  verifiedAt?: string;
  versions: MockVersion[];
  viewCount: number;
}

export interface MockSecretType {
  checkout?: boolean;
  fields: MockFieldDefinition[];
  heartbeat?: boolean;
  id: string;
  name: string;
  origin: "custom" | "extension" | "system";
  rotation?: boolean;
  /** Who made an extension pack's type. */
  vendor?: string;
}

export interface MockSecretUse {
  argv: string[];
  clientLabel: string;
  expiresAtUnix: number;
  fieldKey: string;
  id: string;
  ownerUserId: string;
  reveal: boolean;
  secretId: string;
  secretName: string;
  state: "approved" | "denied" | "expired" | "pending";
}

export interface MockTarget {
  connectionId: string;
  description?: string;
  domain?: string;
  hostname: string;
  id: string;
  kind?: string;
  name: string;
  ownerUserId?: string;
  realm?: string;
  sshHostKeys: string[];
}

export interface MockToken {
  clientName: string;
  createdAtUnix: number;
  expiresAtUnix: number;
  id: string;
  label: string;
  lastUsedAtUnix: number;
  ownerUserId: string;
  revokedAtUnix: number;
}

export interface MockUseGrant {
  allowReveal: boolean;
  expiresAtUnix: number;
  fieldKeys: string[];
  folderId?: string;
  id: string;
  maxUses: number;
  ownerUserId: string;
  programs: { args: string[]; path: string }[];
  revokedAtUnix: number;
  secretIds: string[];
  tokenId: string;
  uses: number;
}

export interface MockVersion {
  active: boolean;
  changedFieldKeys: string[];
  createdAt: string;
  createdBy: string;
  createdByName: string;
  fieldKeys: string[];
  versionNo: number;
}

export interface MockWorld {
  connections: MockConnection[];
  folders: MockFolder[];
  /** Who is in which group. */
  groupMembers: { groupId: string; userId: string }[];
  groups: MockGroup[];
  leases: MockLease[];
  requests: MockRequest[];
  secrets: MockSecret[];
  secretTypes: MockSecretType[];
  secretUses: MockSecretUse[];
  targets: MockTarget[];
  tokens: MockToken[];
  useGrants: MockUseGrant[];
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const notes: MockFieldDefinition = { key: "notes", kind: "multiline", label: "Notes" };

/** The system types the screens use, with the fields the vault defines for them. */
const SECRET_TYPES: MockSecretType[] = [
  {
    fields: [
      { key: "username", kind: "text", label: "Username", required: true },
      { key: "password", kind: "password", label: "Password", required: true, sensitive: true },
      notes,
    ],
    id: "type-password",
    name: "Password",
    origin: "system",
  },
  {
    fields: [
      { key: "url", kind: "text", label: "URL", required: true },
      { key: "username", kind: "text", label: "Username", required: true },
      { key: "password", kind: "password", label: "Password", required: true, sensitive: true },
      notes,
    ],
    id: "type-web-password",
    name: "Web Password",
    origin: "system",
  },
  {
    checkout: true,
    fields: [
      { key: "domain", kind: "text", label: "Domain (FQDN)", required: true },
      { key: "username", kind: "text", label: "Account Name", required: true },
      {
        key: "password",
        kind: "password",
        label: "Password",
        required: true,
        rotates: true,
        sensitive: true,
      },
      { key: "serviceAccount", kind: "boolean", label: "Service account" },
      notes,
    ],
    heartbeat: true,
    id: "type-active-directory",
    name: "Active Directory Account",
    origin: "system",
    rotation: true,
  },
  {
    checkout: true,
    fields: [
      { key: "username", kind: "text", label: "Username", required: true },
      {
        key: "keyFormat",
        kind: "select",
        label: "Key Format",
        options: ["OpenSSH", "PEM", "PuTTY"],
      },
      { key: "publicKey", kind: "multiline", label: "Public Key" },
      {
        key: "privateKey",
        kind: "sensitive",
        label: "Private Key",
        required: true,
        sensitive: true,
      },
      { key: "passphrase", kind: "sensitive", label: "Passphrase", sensitive: true },
      notes,
    ],
    heartbeat: true,
    id: "type-ssh-key",
    name: "SSH Key",
    origin: "system",
  },
  {
    fields: [
      {
        key: "engine",
        kind: "select",
        label: "Engine",
        options: ["PostgreSQL", "MySQL", "SQL Server"],
      },
      { key: "server", kind: "text", label: "Server", required: true },
      { key: "port", kind: "text", label: "Port" },
      { key: "username", kind: "text", label: "Username", required: true },
      {
        key: "password",
        kind: "password",
        label: "Password",
        required: true,
        rotates: true,
        sensitive: true,
      },
      notes,
    ],
    heartbeat: true,
    id: "type-database-account",
    name: "Database Account",
    origin: "system",
    rotation: true,
  },
  {
    fields: [
      { key: "scheme", kind: "select", label: "Scheme", options: ["Bearer", "Basic", "Header"] },
      { key: "token", kind: "sensitive", label: "Token", required: true, sensitive: true },
      { key: "endpoint", kind: "text", label: "Endpoint / API URL" },
      notes,
    ],
    id: "type-api-token",
    name: "API Token",
    origin: "system",
  },
  {
    fields: [
      { key: "certificate", kind: "multiline", label: "Certificate", required: true },
      {
        key: "privateKey",
        kind: "sensitive",
        label: "Private Key",
        sensitive: true,
        superSensitive: true,
      },
      { key: "subject", kind: "text", label: "Subject" },
      { key: "issuer", kind: "text", label: "Issuer" },
      { key: "notAfter", kind: "text", label: "Not After" },
    ],
    id: "type-ssl-cert",
    name: "SSL/PKI Certificate",
    origin: "system",
  },
  {
    fields: [{ key: "note", kind: "multiline", label: "Note", required: true, sensitive: true }],
    id: "type-secure-note",
    name: "Secure Note",
    origin: "system",
  },
  {
    fields: [
      { key: "host", kind: "text", label: "Host", required: true },
      { key: "username", kind: "text", label: "Username", required: true },
      {
        key: "password",
        kind: "password",
        label: "Password",
        required: true,
        rotates: true,
        sensitive: true,
      },
      { key: "enable", kind: "password", label: "Enable secret", sensitive: true },
    ],
    heartbeat: true,
    id: "type-acme-router",
    name: "Acme Router Admin",
    origin: "extension",
    rotation: true,
    vendor: "Acme",
  },
  {
    fields: [
      { key: "gateway", kind: "text", label: "Gateway", required: true },
      { key: "username", kind: "text", label: "Username", required: true },
      { key: "profile", kind: "file", label: "Profile" },
    ],
    id: "type-acme-vpn",
    name: "Acme VPN Profile",
    origin: "extension",
    vendor: "Acme",
  },
  {
    fields: [
      {
        defaultValue: "North door",
        key: "location",
        kind: "select",
        label: "Location",
        options: ["North door", "South door", "Loading bay"],
        required: true,
      },
      {
        key: "code",
        kind: "password",
        label: "Code",
        policyEnforcement: "strict",
        policyId: "mock-policy-pin",
        required: true,
        sensitive: true,
      },
    ],
    id: "type-door-code",
    name: "Break-room Door Code",
    origin: "custom",
  },
];

const GROUPS: MockGroup[] = [
  { id: "mock-group-platform", name: "Platform engineers" },
  { id: "mock-group-db", name: "DB team" },
  { id: "mock-group-finance", name: "Finance" },
];

const GROUP_MEMBERS = [
  { groupId: "mock-group-platform", userId: "mock-user-alice" },
  { groupId: "mock-group-platform", userId: "mock-user-carol" },
  { groupId: "mock-group-db", userId: "mock-user-bob" },
  { groupId: "mock-group-db", userId: "mock-user-dave" },
  { groupId: "mock-group-finance", userId: "mock-user-erin" },
];

const ALICE = "mock-user-alice";
const BOB = "mock-user-bob";
const CAROL = "mock-user-carol";
const DAVE = "mock-user-dave";

const FOLDERS: MockFolder[] = [
  {
    groupId: "mock-group-platform",
    id: "mock-folder-platform",
    name: "Platform",
    order: 0,
    owners: [ALICE, CAROL],
    scope: "group",
  },
  {
    id: "mock-folder-databases",
    name: "Databases",
    order: 0,
    owners: [ALICE],
    parentId: "mock-folder-platform",
    scope: "group",
  },
  {
    id: "mock-folder-network",
    name: "Network",
    order: 1,
    owners: [CAROL],
    parentId: "mock-folder-platform",
    scope: "group",
  },
  {
    id: "mock-folder-certificates",
    name: "Certificates",
    order: 2,
    owners: [CAROL],
    parentId: "mock-folder-platform",
    scope: "group",
  },
  {
    groupId: "mock-group-finance",
    id: "mock-folder-finance",
    name: "Finance",
    order: 1,
    owners: [BOB],
    scope: "group",
  },
  {
    id: "mock-folder-archive",
    name: "Archive",
    order: 0,
    owners: [BOB],
    parentId: "mock-folder-finance",
    scope: "group",
  },
  {
    id: "mock-folder-helpdesk",
    name: "Helpdesk",
    order: 2,
    owners: [CAROL],
    role: "helpdesk",
    scope: "role",
  },
  {
    id: "mock-folder-alice",
    isMasterPersonal: true,
    name: "My secrets",
    order: 0,
    owners: [ALICE],
    ownerUserId: ALICE,
    scope: "personal",
  },
  {
    id: "mock-folder-alice-lab",
    name: "Lab",
    order: 0,
    owners: [ALICE],
    ownerUserId: ALICE,
    parentId: "mock-folder-alice",
    scope: "personal",
  },
  {
    id: "mock-folder-bob",
    isMasterPersonal: true,
    name: "My secrets",
    order: 0,
    owners: [BOB],
    ownerUserId: BOB,
    scope: "personal",
  },
];

const CONNECTIONS: MockConnection[] = [
  {
    description: "Directory over LDAPS",
    id: "mock-conn-ldaps",
    name: "LDAPS",
    port: 636,
    protocol: "ldap",
    useTls: true,
  },
  { description: "Shell access", id: "mock-conn-ssh", name: "SSH", port: 22, protocol: "ssh" },
  { id: "mock-conn-postgres", name: "PostgreSQL", port: 5432, protocol: "postgres", useTls: true },
];

const TARGETS: MockTarget[] = [
  {
    connectionId: "mock-conn-ldaps",
    description: "Directory for the example.org staff accounts",
    domain: "corp.example.org",
    hostname: "dc1.corp.example.org",
    id: "mock-target-dc1",
    kind: "active-directory",
    name: "Corp directory",
    realm: "CORP.EXAMPLE.ORG",
    sshHostKeys: [],
  },
  {
    connectionId: "mock-conn-ssh",
    description: "Build host",
    hostname: "build1.example.org",
    id: "mock-target-build1",
    kind: "linux",
    name: "Build host",
    ownerUserId: ALICE,
    sshHostKeys: ["ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIMockBuild1HostKeyNotReal build1"],
  },
  {
    connectionId: "mock-conn-ssh",
    hostname: "192.0.2.10",
    id: "mock-target-edge-router",
    kind: "network",
    name: "Edge router",
    sshHostKeys: ["ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIMockEdgeHostKeyNotReal edge"],
  },
  {
    connectionId: "mock-conn-postgres",
    hostname: "db1.example.org",
    id: "mock-target-db1",
    kind: "postgres",
    name: "Primary database",
    sshHostKeys: [],
  },
];

/** A version history: `count` versions, the newest active, each by `by`. */
const history = (
  now: number,
  fieldKeys: string[],
  count: number,
  by = ALICE,
  byName = "Alice",
): MockVersion[] =>
  Array.from({ length: count }, (_, index) => {
    const versionNo = count - index;
    return {
      active: index === 0,
      changedFieldKeys: versionNo === 1 ? fieldKeys : [fieldKeys.at(-1) ?? "password"],
      createdAt: new Date(now - (index + 1) * 30 * DAY).toISOString(),
      createdBy: by,
      createdByName: byName,
      fieldKeys,
      versionNo,
    };
  });

const iso = (t: number) => new Date(t).toISOString();
const unix = (t: number) => Math.floor(t / 1000);

interface SecretSeed extends Partial<MockSecret> {
  fields: Record<string, string>;
  folderId: string;
  id: string;
  name: string;
  typeId: string;
}

const secret = (now: number, seed: SecretSeed, versions = 1): MockSecret => ({
  heartbeatOptOut: false,
  requireTokenApproval: false,
  retired: false,
  retiredAt: "",
  rotationOptOut: false,
  versions: history(now, Object.keys(seed.fields), versions),
  viewCount: 0,
  ...seed,
});

const secrets = (now: number): MockSecret[] => [
  secret(
    now,
    {
      fields: {
        domain: "corp.example.org",
        notes: "Remote access for the platform team.",
        password: "mock-Lace-Up-4417",
        serviceAccount: "false",
        username: "svc-vpn",
      },
      folderId: "mock-folder-network",
      id: "mock-secret-acme-vpn",
      lastAccessedAt: iso(now - 2 * HOUR),
      lastHeartbeatResult: "ok",
      lastRotationResult: "ok",
      name: "Acme VPN",
      nextRotationAt: iso(now + 20 * DAY),
      rotatedAt: iso(now - 10 * DAY),
      rotationIntervalDays: 30,
      targetId: "mock-target-dc1",
      typeId: "type-active-directory",
      verifiedAt: iso(now - HOUR),
      viewCount: 42,
    },
    4,
  ),
  secret(
    now,
    {
      fields: {
        engine: "PostgreSQL",
        password: "mock-Tongue-Eyelet-91",
        port: "5432",
        server: "db1.example.org",
        username: "postgres_admin",
      },
      folderId: "mock-folder-databases",
      id: "mock-secret-db-admin",
      lastAccessedAt: iso(now - DAY),
      lastHeartbeatResult: "failed",
      lastRotationResult: "failed",
      name: "DB admin",
      rotatedAt: iso(now - 40 * DAY),
      rotationIntervalDays: 30,
      targetId: "mock-target-db1",
      typeId: "type-database-account",
      verifiedAt: iso(now - 3 * DAY),
      viewCount: 31,
    },
    3,
  ),
  secret(now, {
    fields: {
      engine: "PostgreSQL",
      password: "mock-Aglet-Outsole-27",
      port: "5432",
      server: "db1.example.org",
      username: "reporting_ro",
    },
    folderId: "mock-folder-databases",
    heartbeatOptOut: true,
    id: "mock-secret-db-reporting",
    name: "Reporting reader",
    targetId: "mock-target-db1",
    typeId: "type-database-account",
    viewCount: 6,
  }),
  secret(
    now,
    {
      fields: {
        keyFormat: "OpenSSH",
        passphrase: "mock-passphrase-heel",
        privateKey: "mock private key for the build host, not a real key",
        publicKey: "ssh-ed25519 mock-public-key-build alice@example.org",
        username: "deploy",
      },
      folderId: "mock-folder-platform",
      id: "mock-secret-build-ssh",
      lastAccessedAt: iso(now - 5 * HOUR),
      lastHeartbeatResult: "ok",
      name: "Build host deploy key",
      requireTokenApproval: true,
      targetId: "mock-target-build1",
      typeId: "type-ssh-key",
      verifiedAt: iso(now - 6 * HOUR),
      viewCount: 18,
    },
    2,
  ),
  secret(now, {
    fields: { notes: "Console only.", password: "mock-Vamp-Collar-63", username: "admin" },
    folderId: "mock-folder-network",
    id: "mock-secret-edge-router",
    lastHeartbeatResult: "unreachable",
    name: "Edge router admin",
    targetId: "mock-target-edge-router",
    typeId: "type-password",
    verifiedAt: iso(now - 9 * DAY),
    viewCount: 9,
  }),
  secret(now, {
    expiresAt: iso(now + 5 * DAY),
    fields: {
      certificate: "mock certificate for portal.example.org",
      issuer: "CN=Example Issuing CA",
      notAfter: iso(now + 5 * DAY),
      privateKey: "mock certificate key, not a real key",
      subject: "CN=portal.example.org",
    },
    folderId: "mock-folder-certificates",
    id: "mock-secret-portal-cert",
    name: "portal.example.org",
    typeId: "type-ssl-cert",
    viewCount: 3,
  }),
  secret(now, {
    expiresAt: iso(now - 2 * DAY),
    fields: {
      certificate: "mock certificate for old.example.org",
      issuer: "CN=Example Issuing CA",
      notAfter: iso(now - 2 * DAY),
      subject: "CN=old.example.org",
    },
    folderId: "mock-folder-certificates",
    id: "mock-secret-old-cert",
    name: "old.example.org",
    typeId: "type-ssl-cert",
    viewCount: 1,
  }),
  secret(now, {
    expiresAt: iso(now + 21 * DAY),
    fields: {
      endpoint: "https://api.example.com/v2",
      scheme: "Bearer",
      token: "mock-token-insole-5521",
    },
    folderId: "mock-folder-platform",
    id: "mock-secret-status-api",
    lastAccessedAt: iso(now - 30 * 60_000),
    name: "Status page API",
    typeId: "type-api-token",
    viewCount: 57,
  }),
  secret(
    now,
    {
      fields: {
        password: "mock-Welt-Toecap-08",
        url: "https://payroll.example.com",
        username: "finance-team",
      },
      folderId: "mock-folder-finance",
      id: "mock-secret-payroll",
      lastAccessedAt: iso(now - 3 * DAY),
      name: "Payroll portal",
      typeId: "type-web-password",
      viewCount: 12,
    },
    2,
  ),
  secret(now, {
    fields: {
      password: "mock-Old-Shank-12",
      url: "https://legacy.example.com",
      username: "finance",
    },
    folderId: "mock-folder-archive",
    id: "mock-secret-legacy-portal",
    name: "Legacy portal",
    retired: true,
    retiredAt: iso(now - 60 * DAY),
    typeId: "type-web-password",
  }),
  secret(now, {
    fields: {
      domain: "corp.example.org",
      password: "mock-Heel-Counter-30",
      serviceAccount: "false",
      username: "helpdesk-reset",
    },
    folderId: "mock-folder-helpdesk",
    id: "mock-secret-helpdesk",
    lastHeartbeatResult: "ok",
    name: "Helpdesk reset account",
    targetId: "mock-target-dc1",
    typeId: "type-active-directory",
    viewCount: 4,
  }),
  secret(now, {
    fields: { note: "Lab wifi: mock-wifi-passphrase" },
    folderId: "mock-folder-alice-lab",
    id: "mock-secret-alice-wifi",
    name: "Lab wifi",
    typeId: "type-secure-note",
    viewCount: 2,
  }),
  secret(now, {
    fields: { password: "mock-Bob-Brogue-77", username: "bob" },
    folderId: "mock-folder-bob",
    id: "mock-secret-bob-laptop",
    name: "Laptop login",
    typeId: "type-password",
  }),
];

const requests = (now: number): MockRequest[] => [
  {
    comments: [],
    destParentId: "",
    destParentName: "",
    folderId: "mock-folder-network",
    folderName: "Platform / Network",
    id: "mock-req-1",
    kind: "secret_access",
    reason: "Need the VPN to patch the edge router tonight.",
    requestedAt: iso(now - 40 * 60_000),
    requestedByUserId: BOB,
    secretId: "mock-secret-acme-vpn",
    status: "pending",
  },
  {
    comments: [
      {
        authorName: "Alice",
        authorUserId: ALICE,
        body: "Which change ticket is this for?",
        createdAt: iso(now - 2 * HOUR),
        id: "mock-comment-1",
      },
    ],
    destParentId: "",
    destParentName: "",
    folderId: "mock-folder-databases",
    folderName: "Platform / Databases",
    id: "mock-req-2",
    kind: "secret_access",
    reason: "Read-only access for the quarterly report.",
    requestedAt: iso(now - 3 * HOUR),
    requestedByUserId: DAVE,
    secretId: "mock-secret-db-admin",
    status: "pending",
  },
  {
    comments: [],
    destParentId: "",
    destParentName: "",
    folderId: "mock-folder-finance",
    folderName: "Finance",
    id: "mock-req-3",
    kind: "secret_access",
    reason: "Month-end close.",
    requestedAt: iso(now - 2 * DAY),
    requestedByUserId: BOB,
    resolvedAt: iso(now - 2 * DAY + HOUR),
    resolvedByUserId: ALICE,
    resolvedByUserName: "Alice",
    secretId: "mock-secret-payroll",
    status: "approved",
  },
  {
    comments: [],
    destParentId: "mock-folder-platform",
    destParentName: "Platform",
    folderId: "mock-folder-archive",
    folderName: "Finance / Archive",
    id: "mock-req-4",
    kind: "folder_move",
    reason: "Archive belongs with the platform folders now.",
    requestedAt: iso(now - 5 * DAY),
    requestedByUserId: BOB,
    resolvedAt: iso(now - 4 * DAY),
    resolvedByUserId: CAROL,
    resolvedByUserName: "Carol",
    secretId: "",
    status: "denied",
  },
];

/** Build a fresh world, with times relative to `now`. */
export const initialWorld = (now = Date.now()): MockWorld => {
  return {
    connections: structuredClone(CONNECTIONS),
    folders: structuredClone(FOLDERS),
    groupMembers: structuredClone(GROUP_MEMBERS),
    groups: structuredClone(GROUPS),
    leases: [
      {
        expiresAt: iso(now + 2 * HOUR),
        id: "mock-lease-1",
        issuedAt: iso(now - 2 * HOUR),
        returned: false,
        secretId: "mock-secret-acme-vpn",
        userId: ALICE,
      },
      {
        expiresAt: iso(now + 6 * HOUR),
        id: "mock-lease-2",
        issuedAt: iso(now - 30 * 60_000),
        returned: false,
        secretId: "mock-secret-build-ssh",
        userId: BOB,
      },
      {
        expiresAt: iso(now - DAY + 4 * HOUR),
        id: "mock-lease-3",
        issuedAt: iso(now - DAY),
        returned: true,
        secretId: "mock-secret-helpdesk",
        userId: ALICE,
      },
    ],
    requests: requests(now),
    secrets: secrets(now),
    secretTypes: structuredClone(SECRET_TYPES),
    secretUses: [
      {
        argv: ["psql", "-h", "db1.example.org", "-U", "postgres_admin"],
        clientLabel: "Build agent on build1",
        expiresAtUnix: unix(now + 10 * 60_000),
        fieldKey: "password",
        id: "mock-use-1",
        ownerUserId: ALICE,
        reveal: false,
        secretId: "mock-secret-db-admin",
        secretName: "DB admin",
        state: "pending",
      },
      {
        argv: [],
        clientLabel: "Build agent on build1",
        expiresAtUnix: unix(now - HOUR),
        fieldKey: "token",
        id: "mock-use-2",
        ownerUserId: ALICE,
        reveal: true,
        secretId: "mock-secret-status-api",
        secretName: "Status page API",
        state: "approved",
      },
    ],
    targets: structuredClone(TARGETS),
    tokens: [
      {
        clientName: "Build agent",
        createdAtUnix: unix(now - 20 * DAY),
        expiresAtUnix: unix(now + 70 * DAY),
        id: "mock-token-1",
        label: "build1 agent",
        lastUsedAtUnix: unix(now - 10 * 60_000),
        ownerUserId: ALICE,
        revokedAtUnix: 0,
      },
      {
        clientName: "sneakers CLI",
        createdAtUnix: unix(now - 90 * DAY),
        expiresAtUnix: unix(now - 5 * DAY),
        id: "mock-token-2",
        label: "old laptop",
        lastUsedAtUnix: unix(now - 30 * DAY),
        ownerUserId: ALICE,
        revokedAtUnix: 0,
      },
      {
        clientName: "Build agent",
        createdAtUnix: unix(now - 3 * DAY),
        expiresAtUnix: unix(now + 27 * DAY),
        id: "mock-token-3",
        label: "Bob's workstation",
        lastUsedAtUnix: 0,
        ownerUserId: BOB,
        revokedAtUnix: 0,
      },
    ],
    useGrants: [
      {
        allowReveal: false,
        expiresAtUnix: unix(now + 7 * DAY),
        fieldKeys: ["password"],
        id: "mock-grant-1",
        maxUses: 20,
        ownerUserId: ALICE,
        programs: [{ args: ["-h", "db1.example.org"], path: "psql" }],
        revokedAtUnix: 0,
        secretIds: ["mock-secret-db-admin"],
        tokenId: "mock-token-1",
        uses: 3,
      },
    ],
  };
};
