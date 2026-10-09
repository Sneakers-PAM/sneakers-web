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

/** A recovery key the box made: the private key is in this answer once and never kept. */
export interface GenerateRecoveryKeyResponse {
  /** A suggested name for the private key file. */
  fileName: string;
  /** The OpenSSH private key. */
  privateKey: string;
  /** The OpenSSH public key line the box keeps. */
  publicKey: string;
  recoveryKey: RecoveryKey;
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
  | "WARNING_KIND_NETWORK_PENDING"
  | "WARNING_KIND_NETWORK_REVERTED"
  | "WARNING_KIND_NTP_UNSYNCED"
  | "WARNING_KIND_REDUCED_PROTECTION"
  | "WARNING_KIND_SELF_SIGNED_TLS"
  | "WARNING_KIND_TLS_EXPIRED"
  | "WARNING_KIND_TLS_EXPIRING"
  | "WARNING_KIND_TLS_NAMES"
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

/** StatusService.GetPhase: "firstboot" until setup's Finish, then "normal". */
export interface GetPhaseResponse {
  phase: string;
  /** An update's steps while one runs and for 15 minutes after, for the restart page before
   * anyone signs in: the steps' ids, labels and states only, with no version, detail or code. */
  upgradeProgress?: UpgradeProgress;
}

/** The network change window, as GetStatus gives it so every page can show it. */
export interface NetworkChange {
  /** Names the pending change in the audit. */
  changeId: string;
  /** The last change that waited was undone; lastChangeId names it. */
  lastReverted: boolean;
  /** It was undone because the box stopped or restarted inside its window. */
  lastRevertedAtStart: boolean;
  lastChangeId: string;
  /** A change waits for ConfirmNetwork. */
  pending: boolean;
  revertSecondsLeft: number;
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
  /** The network change waiting for its confirmation, and how the last one ended; left out by a
   * box from before it. */
  networkChange?: NetworkChange;
  ntpSynced: boolean;
  phase: string;
  /** The slot the revert target is in, A or B; empty with no revert target, or when the box
   * can't tell which slot it runs from. */
  previousSlot: string;
  /** The older release kept in the other slot that a revert boots; empty when there's none. */
  previousVersion: string;
  protection: Protection;
  protectionReason: string;
  /** When an admin reverted the base release: the release reverted from, who, and when. */
  revertedAt?: string;
  revertedBy?: string;
  revertedVersion?: string;
  runningVersion: string;
  stagedVersion: string;
  tlsExpires?: string;
  tlsFingerprint: string;
  tlsSelfSigned: boolean;
  /** The last stage, apply or revert, step by step; left out when the box has made none. */
  upgradeProgress?: UpgradeProgress;
  version: string;
  /** Empty lists are left out of the JSON: a box with nothing to warn about leaves this out. */
  warnings?: Warning[];
}

// ---- access ----

/** An SSH key the box issued to an admin: an ed25519 key with a certificate from the root key. */
export interface Key {
  added?: string;
  addedBy: string;
  /** The label the admin gave it. */
  comment: string;
  fingerprint: string;
  lastUsed?: string;
  /** The certificate's serial, the one the revocation list names. */
  serial?: string;
  type: string;
  /** When the certificate stops working. */
  validBefore?: string;
  via: string;
}

export interface Admin {
  created?: string;
  createdBy: string;
  /** False while an invitation is open: no password and authenticator yet. */
  credentialsSet?: boolean;
  failedAttempts?: number;
  /** When an open invitation's code stops working. */
  inviteExpires?: string;
  keys: Key[];
  lastSignIn?: string;
  /** When a timed lockout ends. */
  lockedUntil?: string;
  /** Locked until an owner unlocks the account. */
  lockedUntilUnlocked?: boolean;
  name: string;
  passwordChanged?: string;
  role: Role;
  /** On the root-operator roster. */
  rootOperator?: boolean;
  totpAdded?: string;
  uid: number;
}

export interface HostKey {
  fingerprint: string;
  type: string;
}

/**
 * The root-operator roster: who may open the root shell, and whose approvals count for a
 * factory reset.
 */
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

/** What 3 consecutive failures in 15 minutes do (NIST SP 800-53 AC-7). */
export type LockoutMode =
  "LOCKOUT_MODE_TIMED" | "LOCKOUT_MODE_UNSPECIFIED" | "LOCKOUT_MODE_UNTIL_UNLOCKED";

export interface AccessPolicy {
  lockoutMode: LockoutMode;
  /** How long a root-shell code works, 1 to 60 minutes (default 10). */
  rootCodeMinutes: number;
  /** The longest a root shell stays open, 1 to 60 minutes (default 10). */
  rootSessionMinutes: number;
  /** An issued SSH key's default validity, 1 to 1825 days (default 365). */
  sshKeyValidDays: number;
}

export interface ListAdminsResponse {
  accessPolicy?: AccessPolicy;
  admins: Admin[];
  hostKeys: HostKey[];
  quorum?: Quorum;
  /** Empty lists are left out of the JSON. */
  revokedKeys?: RevokedKey[];
  /** The box's root key (it never leaves the box): its type and fingerprint. */
  rootKey?: HostKey;
  /** The box's SSH host CA, which signs sshd's host certificate: its type and fingerprint. */
  hostCa?: HostKey;
  /** The "@cert-authority <names> <host CA key>" line for a client's known_hosts. */
  knownHosts: string;
  /** The root key's public half: the user CA sshd trusts (an authorized_keys line). */
  userCaPublicKey: string;
}

/** A one-time code for an admin to set a password and an authenticator. Shown once. */
export interface Invitation {
  admin: string;
  /** XXXX-XXXX. */
  code: string;
  expires?: string;
}

export interface IssueSshKeyResponse {
  /** The OpenSSH certificate line, saved next to the key as certificateFileName. */
  certificate: string;
  /** Unique per key (by label or serial): <fileName>-cert.pub. */
  certificateFileName: string;
  /** A unique name for the private key file (id_ed25519_<admin>_sneakers_<serial>), so a
   * browser never adds " (1)" and the key, certificate and .ppk names always pair. */
  fileName: string;
  key: Key;
  /** The PuTTY PPK v3 text with the certificate already embedded: the recommended download for
   * PuTTY 0.78+ and MobaXterm 25.1+. */
  ppk: string;
  /** <fileName>.ppk. */
  ppkFileName: string;
  /** PEM PKCS#8 ("PRIVATE KEY"), for tools that take neither the OpenSSH nor the PuTTY form. It
   * carries no certificate, so it pairs with certificateFileName. Shown once. */
  pem: string;
  /** <fileName>.pem. */
  pemFileName: string;
  /** The OpenSSH private key, shown once and never kept by the box. */
  privateKey: string;
  publicKey: string;
  /** <fileName>.pub; the same public key goes with all three private-key forms. */
  publicKeyFileName: string;
  /** The exact OpenSSH command, with the certificate file named: `ssh -i <fileName> -o
   * CertificateFile=<certificateFileName> <admin>@<box>`. */
  sshCommand: string;
  /** A known_hosts line trusting the box's host CA for its host name and management addresses
   * ("@cert-authority <names> <host CA key>"), so the first login has no host key prompt. */
  knownHosts: string;
  /** known_hosts_<box>, for knownHosts. */
  knownHostsFileName: string;
  /** The box's user CA (its root key's public half), which signed the certificate. */
  userCaPublicKey: string;
}

// ---- root shell ----

export interface IssueRootShellCodeResponse {
  /** XXXX-XXXX, typed into the SSH session; it works once, for this challenge only. */
  code: string;
  expires?: string;
  /** How long the root shell may stay open. */
  sessionMinutes: number;
  /** The SSH client the challenge came from, to check. */
  sourceAddress: string;
}

// ---- elevation (root shells) ----

/** issued: a code is out; active: the shell is open; ended or expired after. */
export type ElevationState = "active" | "ended" | "expired" | "issued";

/** One root shell: its challenge, its code and its session. */
export interface Elevation {
  admin: string;
  approved?: string;
  /** The root operator the code was issued to. */
  approvedBy?: string;
  ended?: string;
  /** exit, idle, time-box, terminated or expired. */
  endReason?: string;
  id: string;
  /** The SSH key the login used. */
  keyFingerprint: string;
  /** The session limit the code carries. */
  minutes: number;
  reason: string;
  /** When the SSH menu showed the challenge. */
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

export type CheckState =
  "CHECK_STATE_FAILED" | "CHECK_STATE_OK" | "CHECK_STATE_UNSPECIFIED" | "CHECK_STATE_WARN";

/** One connectivity check. Proto3 JSON leaves out defaults, so an absent state is unspecified. */
export interface NetdCheck {
  /** The NET_* symbol when the check isn't ok. */
  code?: string;
  detail?: string;
  /** link, address, gateway, dns or ntp. */
  name: string;
  /** False for the checks setup can't continue past. */
  skippable?: boolean;
  state?: CheckState;
}

export interface GetNetworkResponse {
  /** The most recent change that waited for a confirmation was undone; lastChangeId names it. */
  lastChangeReverted?: boolean;
  /** It was undone because the box stopped or restarted inside its window. */
  lastChangeRevertedAtStart?: boolean;
  lastChangeId?: string;
  /** What DHCP and router advertisements gave the box, management interface first; the
   * resolver and the clock use them where the settings name none. */
  learntDns?: string[];
  learntNtp?: string[];
  learntSearch?: string[];
  managementAddresses: string[];
  /** The servers the clock asks now: the settings', else DHCP's, else the image's pool. */
  ntpServers?: string[];
  ntpOffsetMs: string;
  ntpSynced: boolean;
  pending: boolean;
  /** The pending change's id, for the audit log; not secret. */
  pendingChangeId?: string;
  /** What ConfirmNetwork takes; sent to owner sessions only, so a reload can still confirm. */
  pendingToken?: string;
  /** Seconds until the pending change reverts. */
  revertSecondsLeft?: number;
  serviceAddresses: string[];
  settings?: NetdSettings;
}

export interface SetNetworkResponse {
  /** The management address changes: confirm from the new address. */
  movesManagement?: boolean;
  /** The box remakes its self-signed certificate for the new name or address. */
  newCertificate?: boolean;
  /** Where the box answers after the change, when the new address is known. */
  newUrl?: string;
  /** The window; 0 when the change was kept at once. */
  revertAfterSeconds: number;
  /** What ConfirmNetwork takes. Empty when the change was kept at once: one of only the DNS
   * servers, search domains, NTP servers, time zone or proxy can't cut anyone off. */
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

export type CertificateSource =
  | "CERTIFICATE_SOURCE_ACME"
  | "CERTIFICATE_SOURCE_CSR_SIGNED"
  | "CERTIFICATE_SOURCE_SELF_SIGNED"
  | "CERTIFICATE_SOURCE_UNSPECIFIED"
  | "CERTIFICATE_SOURCE_UPLOADED";

/** A certificate in the box's store; its key stays sealed on the box. */
export interface StoredCertificate {
  added?: string;
  certificatePem: string;
  /** Each certificate's subject, the leaf first. */
  chain: string[];
  csrId?: string;
  fingerprint: string;
  id: string;
  issuer: string;
  keyType: string;
  names: string[];
  notAfter: string;
  notBefore: string;
  source: CertificateSource;
  subject: string;
  /** The endpoint ids that serve it. */
  usedBy?: string[];
}

export interface PendingCsr {
  created?: string;
  csrPem: string;
  id: string;
  keyType: string;
  names: string[];
  subject: string;
}

export type EndpointSource =
  "ENDPOINT_SOURCE_ACME" | "ENDPOINT_SOURCE_ASSIGNED" | "ENDPOINT_SOURCE_SELF_SIGNED";

export type EndpointState =
  | "ENDPOINT_STATE_EXPIRED"
  | "ENDPOINT_STATE_EXPIRING"
  | "ENDPOINT_STATE_NAMES_NOT_COVERED"
  | "ENDPOINT_STATE_OK"
  | "ENDPOINT_STATE_SELF_SIGNED"
  | "ENDPOINT_STATE_UNAVAILABLE"
  | "ENDPOINT_STATE_UNSPECIFIED";

export interface CertEndpoint {
  available: boolean;
  certificateId?: string;
  expires?: string;
  id: string;
  name: string;
  names?: string[];
  servingFingerprint?: string;
  source?: EndpointSource;
  state: EndpointState;
  stateDetail?: string;
  unavailableReason?: string;
}

export interface AcmeState {
  available: boolean;
  reason?: string;
}

export interface ValidationCheck {
  detail: string;
  /** key, usage, chain, names or validity. */
  name: string;
  passed: boolean;
}

export interface GetCertificateStoreResponse {
  acme?: AcmeState;
  certificates: StoredCertificate[];
  csrs?: PendingCsr[];
  endpoints: CertEndpoint[];
  /** The update mirror's trust; left out when none is set. */
  updateTrust?: UpdateTrust;
}

/** One CA certificate in the update trust. */
export interface TrustedCa {
  issuer: string;
  notAfter?: string;
  /** Colon hex. */
  sha256: string;
  subject: string;
}

/**
 * What an https:// update mirror is checked against beyond the system roots, for the mirror's
 * fetches only: private CAs, and an optional pin on its server certificate.
 */
export interface UpdateTrust {
  cas: TrustedCa[];
  /** Colon hex in capitals; empty when there's no pin. */
  pinSha256: string;
  setAt?: string;
  setBy: string;
}

/** The key a CSR is made with; RSA 4096 is the default. */
export type KeyType =
  "KEY_TYPE_ECDSA_P256" | "KEY_TYPE_ECDSA_P384" | "KEY_TYPE_RSA_3072" | "KEY_TYPE_RSA_4096";

export interface GenerateCsrRequest {
  commonName?: string;
  country?: string;
  keyType: KeyType;
  locality?: string;
  /** At most one extra name; wildcards are refused. */
  names: string[];
  organization?: string;
  organizationalUnit?: string;
  province?: string;
}

export interface ImportCertificateRequest {
  certificatePem?: string;
  chainPem?: string;
  keyPem?: string;
  /** The PFX file, base64. */
  pkcs12?: string;
  pkcs12Password?: string;
  rootPem?: string;
}

export interface AddedCertificate {
  certificate: StoredCertificate;
  checks: ValidationCheck[];
}

// ---- product ----

/** One value the installed product's bundle lets owners and admins read without a root shell. */
export interface ExposedValue {
  /** True once a one-time value was used; it isn't shown again. */
  consumed: boolean;
  label: string;
  /** The product page that takes the value; empty when the product names none. */
  link: string;
  /** The command word: "<product> <name>" in the closed shell. */
  name: string;
  oneTime: boolean;
  roles: Role[];
}

export interface ListExposedValuesResponse {
  /** The installed product's command word; empty with no product. */
  product: string;
  productTitle: string;
  values: ExposedValue[];
}

export interface GetExposedValueResponse {
  entry?: ExposedValue;
  productTitle: string;
  /** Empty once a one-time value was used. */
  value: string;
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
  /** Fetch from the release source when no mirror is set or the mirror fails. Off by default. */
  direct?: boolean;
  /** The internal source the .bin files are fetched from, an http:// or https:// base; every .bin
   * is checked by its signature either way. Empty, with direct off, means air-gapped. */
  mirrorUrl: string;
  /** automatic applies a staged release inside the daily window; manual waits for an owner. */
  mode: "automatic" | "manual";
  windowMinutes: number;
  /** HH:MM local. */
  windowStart: string;
  /**
   * Where updates come from: builtin (the list compiled into the root: the release download
   * location, or a lab build's mirror), manual (mirrorUrl) or none (upload only). The box always
   * answers it filled in; a box from before the source leaves it out.
   */
  source?: UpdateSource;
}

export type UpdateSource = "builtin" | "manual" | "none";

/**
 * What an update changes, one of the three update units: the Base OS (the root image, its slots
 * and a reboot), the Base Web (the :8443 pages, switched in place) or the product bundle.
 */
export type UpdateTarget =
  | "UPDATE_TARGET_BASE"
  | "UPDATE_TARGET_BASE_WEB"
  | "UPDATE_TARGET_PRODUCT"
  | "UPDATE_TARGET_UNSPECIFIED";

/** The Base Web unit: which pages :8443 serves, and its slots. */
export interface BaseWebStatus {
  builtinVersion: string;
  /** There's a Base Web to revert: to previousVersion, or with none to the built-in pages. */
  canRevert: boolean;
  /** What the current link names, served or not. */
  currentVersion: string;
  /** Whether the running Base OS is in requiresBaseOs. */
  fits: boolean;
  /** The slot a revert goes back to; empty when a revert goes to the built-in pages. */
  previousVersion: string;
  /** Why the built-in pages serve, or why the last switch didn't take. */
  reason: string;
  /** What the current Base Web needs of the Base OS, such as "0.3.0 to before 0.4.0". */
  requiresBaseOs: string;
  /** The served pages' version; the built-in pages carry the running Base OS's. */
  runningVersion: string;
  /** a or b; empty for the built-in pages. */
  slot: string;
  /** slot or built-in. */
  source: string;
  stagedVersion: string;
}

/** One file the source offers for a unit. */
export interface UnitOffer {
  bases: string[];
  commit: string;
  /** What FetchUpdate takes. */
  fileName: string;
  kind: "full" | "patch";
  /** What the file needs of the Base OS, such as "0.3.0 to before 0.4.0". */
  needs: string;
  /** What taking it means for the other units. */
  note: string;
  /** A Base OS outside the installed product's range: staging it needs the owner's override. */
  outsideProductRange: boolean;
  /** The line to take: the newest Base OS's patch when it fits, else its full file. */
  preferred: boolean;
  productRange: string;
  /** int64, so a string. */
  size: string;
  target?: UpdateTarget;
  version: string;
}

/** Check now's answer: what the source offers for each unit. */
export interface CheckUpdatesResponse {
  baseOs: UnitOffer[];
  baseWeb: UnitOffer[];
  /** A newer Base Web the running Base OS doesn't fit, and the Base OS it needs. */
  baseWebWaits: string;
  checkedAt?: string;
  indexFormat: number;
  product: UnitOffer[];
  /** mirror, builtin or direct, and its address. */
  source: string;
  url: string;
}

/** A fetch of one .bin, while it runs and after. */
export interface FetchProgress {
  bytesPerSecond: string;
  code: string;
  /** int64s, so strings. */
  doneBytes: string;
  error: string;
  etaSeconds: string;
  fileName: string;
  source: string;
  startedAt?: string;
  /** querying, downloading, verifying, done or failed. */
  state: "" | "done" | "downloading" | "failed" | "querying" | "verifying";
  target?: UpdateTarget;
  totalBytes: string;
  updatedAt?: string;
  uploadId: string;
  /** The downloaded file's signature, channel and SHA-256 checked out. */
  verified: boolean;
}

/** The product bundle's slots (k0s, its images and the product) on the state volume. */
export interface ProductSlots {
  /** Empty before the first install. */
  installedVersion?: string;
  /**
   * The installed product's name for people, such as "Sneakers"; empty with no product. The nav
   * shows the product's own section under it.
   */
  name?: string;
  /** The slot a revert goes back to; empty when there is none. */
  previousVersion?: string;
  /** The installed product's base range, such as "0.2.0 to 0.3.0"; fits says whether the
   * running Base OS is in it. */
  fits?: boolean;
  requiresBaseOs?: string;
  /** The product services (k0s) are running. */
  running?: boolean;
  stagedVersion?: string;
}

/** One product bundle a source offers. */
export interface ProductVersion {
  arch: string;
  /** The exact base versions a bundle sealed before the base range existed fits. */
  bases: string[];
  channel: string;
  /** What FetchUpdate takes, such as sneakers-product-0.2.0-amd64.bin. */
  fileName: string;
  /** The bundle's base range, inclusive; maxBase is empty with no maximum, and both are empty
   * for a bundle that names exact bases only. */
  maxBase: string;
  minBase: string;
  size: string;
  /** mirror or direct: where the index came from. */
  source: string;
  version: string;
}

export interface ListProductVersionsResponse {
  /** The running base they were matched against. */
  baseVersion: string;
  /** Newest first. Empty lists are left out of the JSON. */
  versions?: ProductVersion[];
}

/** A verified .bin's signed header, as StageUpdate returns it. */
export interface UpdatePackage {
  arch: string;
  bases: string[];
  channel: string;
  /** A Base OS patch's full release, which the box takes when the patch doesn't apply. */
  fullBin?: string;
  /** upload, mirror or direct. */
  source?: string;
  kind: "full" | "patch";
  /** A product bundle's base range, as in ProductVersion. */
  maxBase: string;
  minBase: string;
  sha256: string;
  size: string;
  target?: UpdateTarget;
  uploadId: string;
  version: string;
}

export type UpgradeStepState =
  | "UPGRADE_STEP_STATE_ACTIVE"
  | "UPGRADE_STEP_STATE_DONE"
  | "UPGRADE_STEP_STATE_FAILED"
  | "UPGRADE_STEP_STATE_PENDING"
  | "UPGRADE_STEP_STATE_UNSPECIFIED";

/** One step of a stage, apply or revert. */
export interface UpgradeStep {
  /** What an active step is doing or waiting for, or why a failed step failed. */
  detail: string;
  /** Bytes written of totalBytes where the step has a progress (the root image going into the
   * slot); int64, so a string. totalBytes is "0" otherwise. */
  doneBytes: string;
  /** verify, stage, switch, reboot, health or mark_good for a base release; verify, stage,
   * switch, restart, k0s, images, manifests, pods or edge for a product bundle (restart on,
   * osadmin's own ticks carry a product apply or revert the rest of the way, sneakers-appliance
   * #218). A step can go back (a pod that comes up then falls over), so read each step's own
   * state and never assume the order. */
  id: string;
  /** The step as the screens show it, such as "Staging into slot B" or "Pulling the product's
   * images"; the server's own wording, shown as given. */
  label: string;
  state: UpgradeStepState;
  totalBytes: string;
}

/** The box's last stage, apply or revert, step by step. A base apply's steps after the reboot
 * (checking health, marking good) come from the release the box booted. */
export interface UpgradeProgress {
  action: "" | "apply" | "revert" | "stage";
  /** The failure's code, such as UPGRADE_SIGNATURE, when a step failed with one. */
  code: string;
  failed: boolean;
  inProgress: boolean;
  startedAt?: string;
  /** In order: done, then the active or failed one, then pending. */
  steps: UpgradeStep[];
  target?: UpdateTarget;
  updatedAt?: string;
  /** The release staged or applied, or the one a revert goes back to. */
  version: string;
}

export interface UpgradeEvent {
  action: "apply" | "discard" | "fetch" | "revert" | "stage";
  actor: string;
  code: string;
  detail: string;
  outcome: "failed" | "ok";
  target?: UpdateTarget;
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

/** A received or fetched .bin not yet staged or discarded; while one is held the box refuses a
 * new upload or fetch (UPGRADE_BUSY). */
export interface HeldUpload {
  /** The name the browser sent with the upload, or the fetched file's; empty when none. */
  fileName: string;
  receivedAt?: string;
  /** int64, so a string. */
  size: string;
  /** upload, mirror or direct. */
  source: string;
  uploadId: string;
}

export interface GetUpgradesResponse {
  /** The elevated shells open now; Apply and Revert are refused while there is one. */
  activeElevations?: Elevation[];
  airGapped: boolean;
  /** This build has a release source to fetch from directly (production builds). */
  directAvailable?: boolean;
  failedVersion: string;
  /** The file waiting to be verified or cancelled; left out when there's none. */
  heldUpload?: HeldUpload;
  /** Empty lists are left out of the JSON: a box with no update event yet leaves this out. */
  history?: UpgradeEvent[];
  /** The base releases staging a base update removes, with their files: the revert target, or a
   * staged release. Staging writes over the other slot, so they go at the stage, not the apply. */
  nextStageRemoves: string[];
  policy?: UpgradePolicy;
  /** The slot the revert target is in, A or B; empty with no revert target, or when the box
   * can't tell which slot it runs from. */
  previousSlot: string;
  /** The older release kept in the other slot that a revert boots; empty when there's none. */
  previousVersion: string;
  /** The product bundle's slots; left out by a box from before product bundles. */
  product?: ProductSlots;
  /** When an admin reverted the base release: the release reverted from, who, and when. */
  revertedAt?: string;
  revertedBy?: string;
  revertedVersion?: string;
  /** True while an upload or fetch is coming in. */
  receiving: boolean;
  runningVersion: string;
  stagedVersion: string;
  /** The last stage, apply or revert, step by step; left out when the box has made none. */
  upgradeProgress?: UpgradeProgress;
  /** The mirror's transport and its last fetch; left out when no mirror is set. */
  mirrorStatus?: MirrorStatus;
  /** The Base Web unit; left out by a box from before the units. */
  baseWeb?: BaseWebStatus;
  /** The last Check now since osadmin started. */
  lastCheck?: CheckUpdatesResponse;
  /** The last fetch, while it runs and after. */
  fetchProgress?: FetchProgress;
  /** For a staged Base OS whose built-in pages the installed Base Web doesn't fit: what the box
   * serves after the reboot. */
  baseOsNote: string;
}

/**
 * How the box reaches the mirror and how its last fetch went. The box keeps it in memory, so
 * `checked` is false after a restart until the next mirror fetch.
 */
export interface MirrorStatus {
  checked: boolean;
  checkedAt?: string;
  /** The last fetch's refusal: its code (UPGRADE_MIRROR_UNTRUSTED, UPGRADE_MIRROR_PIN,
   * UPGRADE_UPLOAD) and the box's reason. */
  code: string;
  /** The update trust adds a private CA. */
  customCa: boolean;
  error: string;
  /** The transport in words, such as "plain HTTP: integrity from the signature only". */
  note: string;
  ok: boolean;
  pinMatched: boolean;
  /** The update trust pins the server certificate. */
  pinned: boolean;
  /** http or https. */
  scheme: string;
  /** The policy's source (builtin or manual), the mirror this status is about, and the
   * built-in list in order. */
  builtinUrls: string[];
  source: string;
  url: string;
  /** The server certificate the last HTTPS fetch was presented with, refused or not. */
  serverIssuer: string;
  serverNotAfter?: string;
  serverSha256: string;
  serverSubject: string;
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
