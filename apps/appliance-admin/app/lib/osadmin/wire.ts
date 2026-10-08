// osadmin answers through connect-go's protojson codec, which leaves out every field at its
// zero value: an empty list or map, "", 0, false and an enum's *_UNSPECIFIED. An admin with no
// SSH keys comes back with no `keys` at all. Each answer goes through its function here once, in
// client.ts, and comes out with every field the types in types.ts promise, so no page has to
// guard a list or a string. `Wire<T>` is the answer as sent, with every field optional at every
// depth; returning `T` from it makes the compiler name any required field left without a default.
import type {
  AccessPolicy,
  AcmeState,
  ActiveSession,
  AddedCertificate,
  AddonModule,
  Admin,
  AuditEvent,
  BackupPolicy,
  BackupSet,
  CertEndpoint,
  CheckPasswordResponse,
  Component,
  Disk,
  Elevation,
  FactoryReset,
  GenerateRecoveryKeyResponse,
  GetBackupsResponse,
  GetCertificateStoreResponse,
  GetMcpResponse,
  GetNetworkResponse,
  GetPhaseResponse,
  GetPowerResponse,
  GetSetupResponse,
  GetStatusResponse,
  GetUpgradesResponse,
  HostKey,
  Invitation,
  IssueRootShellCodeResponse,
  IssueSshKeyResponse,
  Key,
  ListAdminsResponse,
  ListElevationsResponse,
  ListEventsResponse,
  ListModulesResponse,
  ListProductVersionsResponse,
  ListSessionsResponse,
  NetdAddress,
  NetdCheck,
  NetdSettings,
  PendingCsr,
  ProductSlots,
  ProductVersion,
  Quorum,
  RecoveryKey,
  RedeemCodeResponse,
  RevokedKey,
  RunChecksResponse,
  Session,
  SetNetworkResponse,
  SetupStep,
  StoredCertificate,
  TotpEnrolment,
  UpdatePackage,
  UpgradeEvent,
  UpgradePolicy,
  UpgradeProgress,
  UpgradeStep,
  ValidationCheck,
  Warning,
} from "@/lib/osadmin/types";

export type Wire<T> = T extends readonly (infer U)[]
  ? Wire<U>[]
  : T extends object
    ? { [K in keyof T]?: Wire<T[K]> }
    : T;

const list = <W, T>(items: undefined | W[], each: (item: W) => T): T[] =>
  (items ?? []).map((item) => each(item));
const texts = (items: string[] | undefined): string[] => items ?? [];
/**
 * A proto string the types narrow to a few words: left out, it was "", which none of the words
 * is. The page shows it blank, as it would show the empty string.
 */
const word = <T extends string>(value: T | undefined): T => value ?? ("" as T);
const optional = <W, T>(value: undefined | W, each: (item: W) => T): T | undefined =>
  value === undefined ? undefined : each(value);

// ---- signin ----

export const session = (w: Wire<Session> = {}): Session => ({
  ...w,
  admin: w.admin ?? "",
  csrfToken: w.csrfToken ?? "",
  notices: texts(w.notices),
  role: w.role ?? "ROLE_UNSPECIFIED",
});

export const withSession = (w: Wire<{ session: Session }>): { session: Session } => ({
  session: session(w.session),
});

export const maybeSession = (w: Wire<{ session?: Session }>): { session?: Session } => ({
  session: optional(w.session, session),
});

// ---- setup ----

export const recoveryKey = (w: Wire<RecoveryKey> = {}): RecoveryKey => ({
  ...w,
  fingerprint: w.fingerprint ?? "",
  label: w.label ?? "",
  setBy: w.setBy ?? "",
  type: w.type ?? "",
});

export const withRecoveryKey = (
  w: Wire<{ recoveryKey: RecoveryKey }>,
): { recoveryKey: RecoveryKey } => ({ recoveryKey: recoveryKey(w.recoveryKey) });

export const generateRecoveryKey = (
  w: Wire<GenerateRecoveryKeyResponse>,
): GenerateRecoveryKeyResponse => ({
  fileName: w.fileName ?? "",
  privateKey: w.privateKey ?? "",
  publicKey: w.publicKey ?? "",
  recoveryKey: recoveryKey(w.recoveryKey),
});

const setupStep = (w: Wire<SetupStep>): SetupStep => ({
  ...w,
  kind: w.kind ?? "SETUP_STEP_KIND_UNSPECIFIED",
  number: w.number ?? 0,
});

export const getSetup = (w: Wire<GetSetupResponse>): GetSetupResponse => ({
  ...w,
  adminCount: w.adminCount ?? 0,
  done: w.done ?? false,
  escrowFile: w.escrowFile ?? "",
  maxRecoveryKeys: w.maxRecoveryKeys ?? 0,
  productSetupUrl: w.productSetupUrl ?? "",
  recoveryKeys: list(w.recoveryKeys, recoveryKey),
  singleAdminAcknowledged: w.singleAdminAcknowledged ?? false,
  singleAdminWarning: w.singleAdminWarning ?? false,
  steps: list(w.steps, setupStep),
});

export const redeemCode = (w: Wire<RedeemCodeResponse>): RedeemCodeResponse => ({
  ...w,
  existingOwners: texts(w.existingOwners),
  kind: w.kind ?? "CODE_KIND_UNSPECIFIED",
});

export const checkPassword = (w: Wire<CheckPasswordResponse>): CheckPasswordResponse => ({
  ...w,
  minLength: w.minLength ?? 0,
});

const totpEnrolment = (w: Wire<TotpEnrolment> = {}): TotpEnrolment => ({
  ...w,
  account: w.account ?? "",
  algorithm: w.algorithm ?? "",
  digits: w.digits ?? 0,
  id: w.id ?? "",
  issuer: w.issuer ?? "",
  periodSeconds: w.periodSeconds ?? 0,
  secret: w.secret ?? "",
  uri: w.uri ?? "",
});

export const withTotp = (w: Wire<{ totp: TotpEnrolment }>): { totp: TotpEnrolment } => ({
  totp: totpEnrolment(w.totp),
});

export const escrow = (
  w: Wire<{ content: string; fileName: string }>,
): { content: string; fileName: string } => ({
  content: w.content ?? "",
  fileName: w.fileName ?? "",
});

export const finish = (w: Wire<{ productSetupUrl: string }>): { productSetupUrl: string } => ({
  productSetupUrl: w.productSetupUrl ?? "",
});

// ---- status ----

const warning = (w: Wire<Warning>): Warning => ({
  detail: w.detail ?? "",
  kind: w.kind ?? "WARNING_KIND_UNSPECIFIED",
});

const component = (w: Wire<Component>): Component => ({
  detail: w.detail ?? "",
  name: w.name ?? "",
  ok: w.ok ?? false,
});

const disk = (w: Wire<Disk>): Disk => ({
  growthBytesPerDay: w.growthBytesPerDay ?? 0,
  path: w.path ?? "",
  totalBytes: w.totalBytes ?? 0,
  usedBytes: w.usedBytes ?? 0,
});

export const factoryReset = (w: Wire<FactoryReset> = {}): FactoryReset => ({
  ...w,
  approvals: texts(w.approvals),
  id: w.id ?? "",
  members: texts(w.members),
  required: w.required ?? 0,
  startedBy: w.startedBy ?? "",
  state: w.state ?? "FACTORY_RESET_STATE_UNSPECIFIED",
});

export const withFactoryReset = (
  w: Wire<{ factoryReset: FactoryReset }>,
): { factoryReset: FactoryReset } => ({ factoryReset: factoryReset(w.factoryReset) });

export const getPhase = (w: Wire<GetPhaseResponse>): GetPhaseResponse => ({
  phase: w.phase ?? "",
  upgradeProgress: optional(w.upgradeProgress, upgradeProgress),
});

export const getStatus = (w: Wire<GetStatusResponse>): GetStatusResponse => ({
  ...w,
  channel: w.channel ?? "",
  custodyMode: w.custodyMode ?? "",
  disk: optional(w.disk, disk),
  factoryReset: optional(w.factoryReset, factoryReset),
  failedVersion: w.failedVersion ?? "",
  health: list(w.health, component),
  hostname: w.hostname ?? "",
  managementAddresses: texts(w.managementAddresses),
  ntpSynced: w.ntpSynced ?? false,
  phase: w.phase ?? "",
  previousSlot: w.previousSlot ?? "",
  previousVersion: w.previousVersion ?? "",
  protection: w.protection ?? "PROTECTION_UNSPECIFIED",
  protectionReason: w.protectionReason ?? "",
  runningVersion: w.runningVersion ?? "",
  stagedVersion: w.stagedVersion ?? "",
  tlsFingerprint: w.tlsFingerprint ?? "",
  tlsSelfSigned: w.tlsSelfSigned ?? false,
  upgradeProgress: optional(w.upgradeProgress, upgradeProgress),
  version: w.version ?? "",
  warnings: list(w.warnings, warning),
});

// ---- access ----

const key = (w: Wire<Key>): Key => ({
  ...w,
  addedBy: w.addedBy ?? "",
  comment: w.comment ?? "",
  fingerprint: w.fingerprint ?? "",
  type: w.type ?? "",
  via: w.via ?? "",
});

export const admin = (w: Wire<Admin> = {}): Admin => ({
  ...w,
  createdBy: w.createdBy ?? "",
  keys: list(w.keys, key),
  name: w.name ?? "",
  role: w.role ?? "ROLE_UNSPECIFIED",
  uid: w.uid ?? 0,
});

const hostKey = (w: Wire<HostKey> = {}): HostKey => ({
  fingerprint: w.fingerprint ?? "",
  type: w.type ?? "",
});

const quorum = (w: Wire<Quorum>): Quorum => ({
  configured: w.configured ?? false,
  members: texts(w.members),
  required: w.required ?? 0,
});

const revokedKey = (w: Wire<RevokedKey>): RevokedKey => ({
  ...w,
  admin: w.admin ?? "",
  fingerprint: w.fingerprint ?? "",
  type: w.type ?? "",
});

const accessPolicy = (w: Wire<AccessPolicy>): AccessPolicy => ({
  lockoutMode: w.lockoutMode ?? "LOCKOUT_MODE_UNSPECIFIED",
  rootCodeMinutes: w.rootCodeMinutes ?? 0,
  rootSessionMinutes: w.rootSessionMinutes ?? 0,
  sshKeyValidDays: w.sshKeyValidDays ?? 0,
});

export const listAdmins = (w: Wire<ListAdminsResponse>): ListAdminsResponse => ({
  accessPolicy: optional(w.accessPolicy, accessPolicy),
  admins: list(w.admins, admin),
  hostKeys: list(w.hostKeys, hostKey),
  quorum: optional(w.quorum, quorum),
  revokedKeys: list(w.revokedKeys, revokedKey),
  rootKey: optional(w.rootKey, hostKey),
});

const invitation = (w: Wire<Invitation> = {}): Invitation => ({
  ...w,
  admin: w.admin ?? "",
  code: w.code ?? "",
});

export const withInvitation = (
  w: Wire<{ invitation: Invitation }>,
): { invitation: Invitation } => ({ invitation: invitation(w.invitation) });

export const addAdmin = (
  w: Wire<{ admin: Admin; invitation: Invitation }>,
): { admin: Admin; invitation: Invitation } => ({
  admin: admin(w.admin),
  invitation: invitation(w.invitation),
});

export const issueSshKey = (w: Wire<IssueSshKeyResponse>): IssueSshKeyResponse => ({
  certificate: w.certificate ?? "",
  fileName: w.fileName ?? "",
  key: key(w.key ?? {}),
  privateKey: w.privateKey ?? "",
  publicKey: w.publicKey ?? "",
});

// ---- root shell and elevation ----

export const issueRootShellCode = (
  w: Wire<IssueRootShellCodeResponse>,
): IssueRootShellCodeResponse => ({
  ...w,
  code: w.code ?? "",
  sessionMinutes: w.sessionMinutes ?? 0,
  sourceAddress: w.sourceAddress ?? "",
});

const elevation = (w: Wire<Elevation>): Elevation => ({
  ...w,
  admin: w.admin ?? "",
  id: w.id ?? "",
  keyFingerprint: w.keyFingerprint ?? "",
  minutes: w.minutes ?? 0,
  reason: w.reason ?? "",
  sourceAddress: w.sourceAddress ?? "",
  state: word(w.state),
});

export const listElevations = (w: Wire<ListElevationsResponse>): ListElevationsResponse => ({
  elevations: list(w.elevations, elevation),
});

// ---- network ----

const netdAddress = (w: Wire<NetdAddress>): NetdAddress => ({
  ...w,
  family: word(w.family),
  mode: word(w.mode),
});

const netdSettings = (w: Wire<NetdSettings>): NetdSettings => ({
  ...w,
  addresses: list(w.addresses, netdAddress),
  allowList: texts(w.allowList),
  dns: texts(w.dns),
  hostname: w.hostname ?? "",
  managementInterface: w.managementInterface ?? "",
  ntp: texts(w.ntp),
  searchDomains: texts(w.searchDomains),
});

export const getNetwork = (w: Wire<GetNetworkResponse>): GetNetworkResponse => ({
  managementAddresses: texts(w.managementAddresses),
  ntpOffsetMs: w.ntpOffsetMs ?? "",
  ntpSynced: w.ntpSynced ?? false,
  pending: w.pending ?? false,
  ...(w.pendingChangeId ? { pendingChangeId: w.pendingChangeId } : {}),
  ...(w.pendingToken ? { pendingToken: w.pendingToken } : {}),
  ...(w.revertSecondsLeft === undefined ? {} : { revertSecondsLeft: w.revertSecondsLeft }),
  serviceAddresses: texts(w.serviceAddresses),
  settings: optional(w.settings, netdSettings),
});

export const setNetwork = (w: Wire<SetNetworkResponse>): SetNetworkResponse => ({
  movesManagement: w.movesManagement ?? false,
  newCertificate: w.newCertificate ?? false,
  ...(w.newUrl ? { newUrl: w.newUrl } : {}),
  revertAfterSeconds: w.revertAfterSeconds ?? 0,
  token: w.token ?? "",
});

const netdCheck = (w: Wire<NetdCheck>): NetdCheck => ({
  ...(w.code ? { code: w.code } : {}),
  detail: w.detail ?? "",
  name: w.name ?? "",
  skippable: w.skippable ?? false,
  state: w.state ?? "CHECK_STATE_UNSPECIFIED",
});

export const runChecks = (w: Wire<RunChecksResponse>): RunChecksResponse => ({
  checks: list(w.checks, netdCheck),
});

// ---- tls ----

const storedCertificate = (w: Wire<StoredCertificate> = {}): StoredCertificate => ({
  ...w,
  certificatePem: w.certificatePem ?? "",
  chain: texts(w.chain),
  fingerprint: w.fingerprint ?? "",
  id: w.id ?? "",
  issuer: w.issuer ?? "",
  keyType: w.keyType ?? "",
  names: texts(w.names),
  notAfter: w.notAfter ?? "",
  notBefore: w.notBefore ?? "",
  source: w.source ?? "CERTIFICATE_SOURCE_UNSPECIFIED",
  subject: w.subject ?? "",
  usedBy: texts(w.usedBy),
});

const pendingCsr = (w: Wire<PendingCsr> = {}): PendingCsr => ({
  ...w,
  csrPem: w.csrPem ?? "",
  id: w.id ?? "",
  keyType: w.keyType ?? "",
  names: texts(w.names),
  subject: w.subject ?? "",
});

export const withCsr = (w: Wire<{ csr: PendingCsr }>): { csr: PendingCsr } => ({
  csr: pendingCsr(w.csr),
});

const certEndpoint = (w: Wire<CertEndpoint> = {}): CertEndpoint => ({
  ...w,
  available: w.available ?? false,
  id: w.id ?? "",
  name: w.name ?? "",
  names: texts(w.names),
  state: w.state ?? "ENDPOINT_STATE_UNSPECIFIED",
});

export const withEndpoint = (w: Wire<{ endpoint: CertEndpoint }>): { endpoint: CertEndpoint } => ({
  endpoint: certEndpoint(w.endpoint),
});

const acmeState = (w: Wire<AcmeState>): AcmeState => ({ ...w, available: w.available ?? false });

const validationCheck = (w: Wire<ValidationCheck>): ValidationCheck => ({
  detail: w.detail ?? "",
  name: w.name ?? "",
  passed: w.passed ?? false,
});

export const addedCertificate = (w: Wire<AddedCertificate>): AddedCertificate => ({
  certificate: storedCertificate(w.certificate),
  checks: list(w.checks, validationCheck),
});

export const getCertificateStore = (
  w: Wire<GetCertificateStoreResponse>,
): GetCertificateStoreResponse => ({
  acme: optional(w.acme, acmeState),
  certificates: list(w.certificates, storedCertificate),
  csrs: list(w.csrs, pendingCsr),
  endpoints: list(w.endpoints, certEndpoint),
});

// ---- mcp ----

export const getMcp = (w: Wire<GetMcpResponse>): GetMcpResponse => ({
  machineApiEnabled: w.machineApiEnabled ?? false,
  mcpEnabled: w.mcpEnabled ?? false,
  state: w.state ?? "",
});

// ---- backup ----

const backupSet = (w: Wire<BackupSet>): BackupSet => ({
  ...w,
  id: w.id ?? "",
  sizeBytes: w.sizeBytes ?? "",
  target: w.target ?? "",
});

const backupPolicy = (w: Wire<BackupPolicy>): BackupPolicy => ({
  retentionDays: w.retentionDays ?? 0,
  schedule: w.schedule ?? "",
  targets: texts(w.targets),
});

export const getBackups = (w: Wire<GetBackupsResponse>): GetBackupsResponse => ({
  policy: optional(w.policy, backupPolicy),
  sets: list(w.sets, backupSet),
});

// ---- upgrade ----

const upgradePolicy = (w: Wire<UpgradePolicy>): UpgradePolicy => ({
  ...w,
  mirrorUrl: w.mirrorUrl ?? "",
  mode: word(w.mode),
  windowMinutes: w.windowMinutes ?? 0,
  windowStart: w.windowStart ?? "",
});

const productSlots = (w: Wire<ProductSlots>): ProductSlots => ({ ...w });

const productVersion = (w: Wire<ProductVersion>): ProductVersion => ({
  arch: w.arch ?? "",
  bases: texts(w.bases),
  channel: w.channel ?? "",
  fileName: w.fileName ?? "",
  size: w.size ?? "",
  source: w.source ?? "",
  version: w.version ?? "",
});

export const listProductVersions = (
  w: Wire<ListProductVersionsResponse>,
): ListProductVersionsResponse => ({
  baseVersion: w.baseVersion ?? "",
  versions: list(w.versions, productVersion),
});

const updatePackage = (w: Wire<UpdatePackage> = {}): UpdatePackage => ({
  ...w,
  arch: w.arch ?? "",
  bases: texts(w.bases),
  channel: w.channel ?? "",
  kind: word(w.kind),
  sha256: w.sha256 ?? "",
  size: w.size ?? "",
  uploadId: w.uploadId ?? "",
  version: w.version ?? "",
});

/** StageUpdate's answer: the package, and for a base release the slot it went into. */
export const stageUpdate = (
  w: Wire<{ package: UpdatePackage; slot?: string }>,
): { package: UpdatePackage; slot?: string } => ({
  package: updatePackage(w.package),
  ...(w.slot ? { slot: w.slot } : {}),
});

export const fetched = (
  w: Wire<{ source?: string; uploadId: string }>,
): { source?: string; uploadId: string } => ({ ...w, uploadId: w.uploadId ?? "" });

const upgradeEvent = (w: Wire<UpgradeEvent>): UpgradeEvent => ({
  ...w,
  action: word(w.action),
  actor: w.actor ?? "",
  code: w.code ?? "",
  detail: w.detail ?? "",
  outcome: word(w.outcome),
  version: w.version ?? "",
});

const upgradeStep = (w: Wire<UpgradeStep>): UpgradeStep => ({
  detail: w.detail ?? "",
  doneBytes: w.doneBytes ?? "0",
  id: w.id ?? "",
  label: w.label ?? "",
  state: w.state ?? "UPGRADE_STEP_STATE_UNSPECIFIED",
  totalBytes: w.totalBytes ?? "0",
});

export const upgradeProgress = (w: Wire<UpgradeProgress>): UpgradeProgress => ({
  ...w,
  action: word(w.action),
  code: w.code ?? "",
  failed: w.failed ?? false,
  inProgress: w.inProgress ?? false,
  steps: list(w.steps, upgradeStep),
  version: w.version ?? "",
});

export const getUpgrades = (w: Wire<GetUpgradesResponse>): GetUpgradesResponse => ({
  ...w,
  activeElevations: list(w.activeElevations, elevation),
  airGapped: w.airGapped ?? false,
  failedVersion: w.failedVersion ?? "",
  history: list(w.history, upgradeEvent),
  nextStageRemoves: texts(w.nextStageRemoves),
  policy: optional(w.policy, upgradePolicy),
  previousSlot: w.previousSlot ?? "",
  previousVersion: w.previousVersion ?? "",
  product: optional(w.product, productSlots),
  runningVersion: w.runningVersion ?? "",
  stagedVersion: w.stagedVersion ?? "",
  upgradeProgress: optional(w.upgradeProgress, upgradeProgress),
});

// ---- modules ----

const addonModule = (w: Wire<AddonModule>): AddonModule => ({
  active: w.active ?? false,
  name: w.name ?? "",
  version: w.version ?? "",
});

export const listModules = (w: Wire<ListModulesResponse>): ListModulesResponse => ({
  available: list(w.available, addonModule),
  platform: w.platform ?? "",
});

// ---- audit ----

const auditEvent = (w: Wire<AuditEvent>): AuditEvent => ({
  ...w,
  action: w.action ?? "",
  actor: w.actor ?? "",
  code: w.code ?? "",
  detail: (w.detail ?? {}) as Record<string, string>,
  keyFingerprint: w.keyFingerprint ?? "",
  outcome: word(w.outcome),
  sourceAddress: w.sourceAddress ?? "",
  target: w.target ?? "",
});

export const listEvents = (w: Wire<ListEventsResponse>): ListEventsResponse => ({
  chainError: w.chainError ?? "",
  chainOk: w.chainOk ?? false,
  events: list(w.events, auditEvent),
  nextPageToken: w.nextPageToken ?? "",
});

// ---- power ----

const activeSession = (w: Wire<ActiveSession>): ActiveSession => ({
  ...w,
  admin: w.admin ?? "",
  id: w.id ?? "",
  kind: w.kind ?? "SESSION_KIND_UNSPECIFIED",
  sourceAddress: w.sourceAddress ?? "",
});

export const listSessions = (w: Wire<ListSessionsResponse>): ListSessionsResponse => ({
  sessions: list(w.sessions, activeSession),
});

export const getPower = (w: Wire<GetPowerResponse>): GetPowerResponse => ({
  factoryReset: optional(w.factoryReset, factoryReset),
  factoryResetAvailable: w.factoryResetAvailable ?? false,
  factoryResetUnavailableReason: w.factoryResetUnavailableReason ?? "",
  sessions: list(w.sessions, activeSession),
});
