// Hand-written TypeScript types for the osadmin Connect API, matching the protobuf JSON
// mapping (camelCase) of proto/sneakers/appliance/osadmin/v1/*.proto in sneakers-appliance.
// There is no generated client yet; this app calls the Connect JSON protocol directly
// (see client.ts) against these shapes.

export type Role = "ROLE_ADMIN" | "ROLE_OWNER" | "ROLE_UNSPECIFIED";

// ---- signin ----

export type SignInState =
  | "SIGN_IN_STATE_APPROVED"
  | "SIGN_IN_STATE_EXPIRED"
  | "SIGN_IN_STATE_PENDING"
  | "SIGN_IN_STATE_UNSPECIFIED";

export interface Session {
  admin: string;
  csrfToken: string;
  expires?: string;
  idleExpires?: string;
  keyFingerprint: string;
  role: Role;
  signedIn?: string;
  stepUpUntil?: string;
}

export interface BeginSignInResponse {
  code: string;
  expires?: string;
  pollToken: string;
  sourceAddress: string;
  userAgent: string;
}

export interface PollSignInResponse {
  session?: Session;
  state: SignInState;
}

// ---- setup ----

export interface RecoveryKey {
  fingerprint: string;
  label: string;
  set?: string;
  setBy: string;
  type: string;
}

export interface GetSetupResponse {
  adminCount: number;
  done: boolean;
  escrowFile: string;
  maxRecoveryKeys: number;
  productSetupUrl: string;
  recoveryKeys: RecoveryKey[];
  singleAdminAcknowledged: boolean;
  singleAdminWarning: boolean;
}

// ---- status ----

export type Protection = "PROTECTION_FULL" | "PROTECTION_REDUCED" | "PROTECTION_UNSPECIFIED";

export type WarningKind =
  | "WARNING_KIND_CONSOLE_RECOVERY"
  | "WARNING_KIND_EXPOSURE"
  | "WARNING_KIND_FACTORY_RESET"
  | "WARNING_KIND_NTP_UNSYNCED"
  | "WARNING_KIND_REDUCED_PROTECTION"
  | "WARNING_KIND_SELF_SIGNED_TLS"
  | "WARNING_KIND_UNSPECIFIED";

export interface Warning {
  detail: string;
  kind: WarningKind;
}

export interface Component {
  detail: string;
  name: string;
  ok: boolean;
}

export interface Disk {
  growthBytesPerDay: number;
  path: string;
  totalBytes: number;
  usedBytes: number;
}

export interface FactoryReset {
  approvals: string[];
  expires?: string;
  id: string;
  members: string[];
  required: number;
  runsAt?: string;
  started?: string;
  startedBy: string;
  state: "FACTORY_RESET_STATE_COUNTDOWN" | "FACTORY_RESET_STATE_PENDING" | "FACTORY_RESET_STATE_UNSPECIFIED";
}

export interface GetStatusResponse {
  channel: string;
  custodyMode: string;
  disk?: Disk;
  factoryReset?: FactoryReset;
  failedVersion: string;
  health: Component[];
  hostname: string;
  managementAddresses: string[];
  ntpSynced: boolean;
  phase: string;
  protection: Protection;
  protectionReason: string;
  runningVersion: string;
  stagedVersion: string;
  tlsExpires?: string;
  tlsFingerprint: string;
  tlsSelfSigned: boolean;
  version: string;
  warnings: Warning[];
}

// ---- access ----

export interface Key {
  added?: string;
  addedBy: string;
  comment: string;
  fingerprint: string;
  lastUsed?: string;
  type: string;
  via: string;
}

export interface Admin {
  approvalHoldUntil?: string;
  created?: string;
  createdBy: string;
  keys: Key[];
  name: string;
  role: Role;
  uid: number;
}

export interface HostKey {
  fingerprint: string;
  type: string;
}

export interface ElevationPolicy {
  defaultMinutes: number;
  maxMinutes: number;
  selfApprovalWhenSingleOwner: boolean;
}

export interface Quorum {
  configured: boolean;
  members: string[];
  required: number;
}

export interface ListAdminsResponse {
  admins: Admin[];
  elevationPolicy?: ElevationPolicy;
  hostKeys: HostKey[];
  quorum?: Quorum;
}

// ---- elevation ----

export type ElevationState = "active" | "approved" | "denied" | "ended" | "expired" | "pending";

export interface Elevation {
  admin: string;
  id: string;
  keyFingerprint: string;
  minutes: number;
  reason: string;
  requested?: string;
  sourceAddress: string;
  state: ElevationState;
}

export interface ListElevationsResponse {
  elevations: Elevation[];
}

// ---- network ----

export interface NetdAddress {
  family: "ipv4" | "ipv6";
  mode: "dhcp" | "off" | "slaac" | "static";
  address?: string;
  gateway?: string;
  prefix?: number;
}

export interface NetdSettings {
  dns: string[];
  hostname: string;
  managementInterface: string;
  ntp: string[];
  addresses: NetdAddress[];
  allowList: string[];
  searchDomains: string[];
  serviceInterface?: string;
}

export interface NetdCheck {
  detail: string;
  name: string;
  status: "failed" | "ok" | "warn";
}

export interface GetNetworkResponse {
  managementAddresses: string[];
  ntpOffsetMs: string;
  ntpSynced: boolean;
  pending: boolean;
  serviceAddresses: string[];
  settings?: NetdSettings;
}

export interface SetNetworkResponse {
  revertAfterSeconds: number;
  token: string;
}

export interface RunChecksResponse {
  checks: NetdCheck[];
}

// ---- tls ----

export interface Certificate {
  expires?: string;
  fingerprint: string;
  issuer: string;
  names: string[];
  subject: string;
}

export interface GetTlsResponse {
  adminUsesProduct: boolean;
  caBundle: Certificate[];
  product?: Certificate;
  source: "acme" | "self-signed" | "uploaded";
}

// ---- mcp ----

export interface GetMcpResponse {
  machineApiEnabled: boolean;
  mcpEnabled: boolean;
  state: string;
}

// ---- backup ----

export interface BackupSet {
  id: string;
  sizeBytes: string;
  taken?: string;
  target: string;
}

export interface BackupPolicy {
  retentionDays: number;
  schedule: string;
  targets: string[];
}

export interface GetBackupsResponse {
  policy?: BackupPolicy;
  sets: BackupSet[];
}

// ---- upgrade ----

export interface UpgradePolicy {
  /** The HTTPS base .bin files are fetched from; empty means air-gapped (upload only). */
  mirrorUrl: string;
  /** automatic applies a staged release inside the daily window; manual waits for an owner. */
  mode: "automatic" | "manual";
  windowMinutes: number;
  /** HH:MM local. */
  windowStart: string;
}

/** A verified .bin's signed header, as StageUpdate returns it. */
export interface UpdatePackage {
  arch: string;
  bases: string[];
  channel: string;
  kind: "full" | "patch";
  sha256: string;
  size: string;
  uploadId: string;
  version: string;
}

export interface UpgradeEvent {
  action: "apply" | "fetch" | "revert" | "stage";
  actor: string;
  code: string;
  detail: string;
  outcome: "failed" | "ok";
  time?: string;
  version: string;
}

export interface GetUpgradesResponse {
  airGapped: boolean;
  failedVersion: string;
  history: UpgradeEvent[];
  policy?: UpgradePolicy;
  runningVersion: string;
  stagedVersion: string;
}

// ---- modules ----

export interface AddonModule {
  active: boolean;
  name: string;
  version: string;
}

export interface ListModulesResponse {
  available: AddonModule[];
  platform: string;
}

// ---- audit ----

export interface AuditEvent {
  action: string;
  actor: string;
  code: string;
  detail: Record<string, string>;
  keyFingerprint: string;
  outcome: "ok" | "refused";
  sourceAddress: string;
  target: string;
  time?: string;
}

export interface ListEventsResponse {
  chainError: string;
  chainOk: boolean;
  events: AuditEvent[];
  nextPageToken: string;
}

// ---- power ----

export interface ActiveSession {
  admin: string;
  signedIn?: string;
  sourceAddress: string;
}

export interface GetPowerResponse {
  factoryReset?: FactoryReset;
  factoryResetAvailable: boolean;
  factoryResetUnavailableReason: string;
  sessions: ActiveSession[];
}
