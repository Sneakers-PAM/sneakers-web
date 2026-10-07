// Hand-written TypeScript types for the osadmin Connect API, matching the protobuf JSON
// mapping (camelCase) of proto/sneakers/appliance/osadmin/v1/*.proto in sneakers-appliance.
// There is no generated client yet; this app calls the Connect JSON protocol directly
// (see client.ts) against these shapes.

export type Role = "ROLE_ADMIN" | "ROLE_OWNER" | "ROLE_UNSPECIFIED";

// ---- signin ----

export interface Session {
  admin: string;
  csrfToken: string;
  expires?: string;
  idleExpires?: string;
  /** Things to tell the admin once after signing in, such as a console Recover access. */
  notices?: string[];
  role: Role;
  /** On the root-operator roster: may get root-shell codes. */
  rootOperator?: boolean;
  signedIn?: string;
  /** Until when sensitive actions go ahead without a fresh TOTP code (StepUp). */
  stepUpUntil?: string;
}

export interface SignInResponse {
  session: Session;
}

// ---- setup ----

export interface RecoveryKey {
  fingerprint: string;
  label: string;
  set?: string;
  setBy: string;
  type: string;
}

/** A one-time code's purpose: the console's setup code, an invitation, or Recover access. */
export type CodeKind =
  "CODE_KIND_INVITE" | "CODE_KIND_RECOVER" | "CODE_KIND_SETUP" | "CODE_KIND_UNSPECIFIED";

export type SetupStepKind =
  | "SETUP_STEP_KIND_ADMIN"
  | "SETUP_STEP_KIND_CODE"
  | "SETUP_STEP_KIND_NETWORK"
  | "SETUP_STEP_KIND_PROTECTION"
  | "SETUP_STEP_KIND_RECOVERY_KEYS"
  | "SETUP_STEP_KIND_SIGN_IN"
  | "SETUP_STEP_KIND_UNSPECIFIED";

export interface SetupStep {
  done?: boolean;
  kind: SetupStepKind;
  /** 1 to 6. */
  number: number;
  optional?: boolean;
}

export interface GetSetupResponse {
  adminCount: number;
  /** The code session's kind; unset for a signed-in admin. */
  codeKind?: CodeKind;
  /** The admin an invitation or Recover access code is for; empty when the name is chosen. */
  codeAdmin?: string;
  codeSessionExpires?: string;
  /** The first step not done, 1 to 6; 0 once setup is done. */
  current?: number;
  done: boolean;
  escrowFile: string;
  firstAdmin?: string;
  maxRecoveryKeys: number;
  productSetupUrl: string;
  /** Empty lists are left out of the JSON. */
  recoveryKeys?: RecoveryKey[];
  /** An admin has signed in with a password and a TOTP code: setup can't finish before. */
  signedIn?: boolean;
  singleAdminAcknowledged: boolean;
  singleAdminWarning: boolean;
  steps?: SetupStep[];
}

export interface RedeemCodeResponse {
  admin?: string;
  /** The X-CSRF-Token for the code session's calls that change something. */
  csrfToken?: string;
  existingOwners?: string[];
  expires?: string;
  kind: CodeKind;
}

export interface CheckPasswordResponse {
  breached?: boolean;
  /** One plain sentence when ok is false. */
  message?: string;
  minLength: number;
  ok?: boolean;
  tooShort?: boolean;
}

/** A new authenticator secret, shown once. */
export interface TotpEnrolment {
  account: string;
  algorithm: string;
  digits: number;
  expires?: string;
  id: string;
  issuer: string;
  periodSeconds: number;
  /** Base32, for typing; shown in groups of four. */
  secret: string;
  /** The otpauth:// URI for the QR code. */
  uri: string;
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
  state:
    | "FACTORY_RESET_STATE_COUNTDOWN"
    | "FACTORY_RESET_STATE_PENDING"
    | "FACTORY_RESET_STATE_UNSPECIFIED";
}

export interface GetStatusResponse {
  channel: string;
  custodyMode: string;
  disk?: Disk;
  factoryReset?: FactoryReset;
  failedVersion: string;
  /** Empty lists are left out of the JSON: a box with no dependency to report leaves this out. */
  health?: Component[];
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
  /** Empty lists are left out of the JSON: a box with nothing to warn about leaves this out. */
  warnings?: Warning[];
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

/** A removed login key, on sshd's revocation list until an owner un-revokes it. */
export interface RevokedKey {
  /** Who the key belonged to. */
  admin: string;
  fingerprint: string;
  revoked?: string;
  /** Who removed the key or its admin: an admin's name, or "console". */
  revokedBy?: string;
  type: string;
}

export interface ListAdminsResponse {
  admins: Admin[];
  elevationPolicy?: ElevationPolicy;
  hostKeys: HostKey[];
  quorum?: Quorum;
  /** Empty lists are left out of the JSON. */
  revokedKeys?: RevokedKey[];
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
  started?: string;
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

/**
 * An owner's override of an open elevated shell on Apply or Revert: the session is ended,
 * audited with the reason, and the update goes ahead once its end is reported.
 */
export interface ElevationOverride {
  /** Typed by the owner: the session's admin, a space and the request id ("bob E-7KQ2"). */
  confirm: string;
  elevationId: string;
  reason: string;
}

export interface GetUpgradesResponse {
  /** The elevated shells open now; Apply and Revert are refused while there is one. */
  activeElevations?: Elevation[];
  airGapped: boolean;
  failedVersion: string;
  /** Empty lists are left out of the JSON: a box with no update event yet leaves this out. */
  history?: UpgradeEvent[];
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

export type SessionKind =
  | "SESSION_KIND_BROWSER"
  | "SESSION_KIND_ELEVATED"
  | "SESSION_KIND_SSH"
  | "SESSION_KIND_UNSPECIFIED";

/** A live session a power action would end, or ListSessions/EndSession can end on its own. */
export interface ActiveSession {
  admin: string;
  /** Names the session for EndSession. Not the session's cookie. */
  id: string;
  kind: SessionKind;
  signedIn?: string;
  sourceAddress: string;
}

export interface ListSessionsResponse {
  sessions: ActiveSession[];
}

export interface GetPowerResponse {
  factoryReset?: FactoryReset;
  factoryResetAvailable: boolean;
  factoryResetUnavailableReason: string;
  sessions: ActiveSession[];
}
