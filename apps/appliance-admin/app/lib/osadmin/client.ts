// Typed wrappers over the Connect API, one object per proto service. Thin by design: every
// method just names the service and RPC the proto declares and forwards the request shape.
import { edge } from "@sneakers-web/edge";

import type {
  AccessPolicy,
  ActiveSession,
  Admin,
  AddonModule,
  BackupPolicy,
  BackupSet,
  AddedCertificate,
  CertEndpoint,
  CheckPasswordResponse,
  Certificate,
  ElevationOverride,
  FactoryReset,
  GenerateCsrRequest,
  GetBackupsResponse,
  GetCertificateStoreResponse,
  GetMcpResponse,
  GetNetworkResponse,
  GetPowerResponse,
  GetSetupResponse,
  GetStatusResponse,
  GetUpgradesResponse,
  ImportCertificateRequest,
  Invitation,
  IssueRootShellCodeResponse,
  IssueSshKeyResponse,
  ListAdminsResponse,
  ListElevationsResponse,
  ListProductVersionsResponse,
  ListEventsResponse,
  ListModulesResponse,
  ListSessionsResponse,
  NetdSettings,
  PendingCsr,
  RecoveryKey,
  RedeemCodeResponse,
  RunChecksResponse,
  Session,
  SetNetworkResponse,
  SetupStepKind,
  SignInResponse,
  TotpEnrolment,
  UpdatePackage,
  UpdateTarget,
  UpgradePolicy,
} from "@/lib/osadmin/types";

import { trackRequest } from "@/lib/readiness";

const call = <Result>(service: string, method: string, body: unknown = {}): Promise<Result> =>
  trackRequest(edge.request<Result>(service, method, body));

export const signIn = {
  getSession: () => call<{ session?: Session }>("SignInService", "GetSession"),
  /** The name, the password and a code from the admin's authenticator. */
  signIn: (admin: string, password: string, totpCode: string) =>
    call<SignInResponse>("SignInService", "SignIn", { admin, password, totpCode }),
  signOut: () => call<Record<string, never>>("SignInService", "SignOut"),
  /** A fresh TOTP code (one never used before) opens 5 more minutes for sensitive actions. */
  stepUp: (totpCode: string) => call<SignInResponse>("SignInService", "StepUp", { totpCode }),
};

export const setup = {
  acknowledgeSingleAdmin: () =>
    call<Record<string, never>>("SetupService", "AcknowledgeSingleAdmin"),
  /** Marks the optional network step or the read-only protection step as seen. */
  acknowledgeStep: (step: SetupStepKind) =>
    call<Record<string, never>>("SetupService", "AcknowledgeStep", { step }),
  /** Checks the name and password, and returns a new TOTP secret; nothing is stored yet. */
  beginCredentials: (admin: string, password: string) =>
    call<{ totp: TotpEnrolment }>("SetupService", "BeginCredentials", { admin, password }),
  /** Whether a password would be taken (12+ characters, not breached); nothing is stored. */
  checkPassword: (password: string, admin: string) =>
    call<CheckPasswordResponse>("SetupService", "CheckPassword", { admin, password }),
  /** Checks a code from the new authenticator, stores the credentials and signs the browser in. */
  completeCredentials: (enrolmentId: string, totpCode: string) =>
    call<{ session: Session }>("SetupService", "CompleteCredentials", { enrolmentId, totpCode }),
  addRecoveryKey: (publicKey: string, label: string) =>
    call<{ recoveryKey: RecoveryKey }>("SetupService", "AddRecoveryKey", {
      label,
      publicKey,
    }),
  downloadEscrow: () =>
    call<{ content: string; fileName: string }>("SetupService", "DownloadEscrow"),
  finish: () => call<{ productSetupUrl: string }>("SetupService", "Finish"),
  get: () => call<GetSetupResponse>("SetupService", "GetSetup"),
  /** A one-time code: the console's setup code, an invitation or Recover access. */
  redeemCode: (code: string) => call<RedeemCodeResponse>("SetupService", "RedeemCode", { code }),
  removeRecoveryKey: (fingerprint: string) =>
    call<Record<string, never>>("SetupService", "RemoveRecoveryKey", { fingerprint }),
};

export const status = {
  get: () => call<GetStatusResponse>("StatusService", "GetStatus"),
  setSecureBoot: (on: boolean, confirmHostname: string) =>
    call<Record<string, never>>("StatusService", "SetSecureBoot", { confirmHostname, on }),
};

export const access = {
  /** A new admin with no password yet; the answer carries the one-time invitation code. */
  addAdmin: (name: string, role: Admin["role"], rootOperator: boolean) =>
    call<{ admin: Admin; invitation: Invitation }>("AccessService", "AddAdmin", {
      name,
      role,
      rootOperator,
    }),
  /** A new authenticator secret for the caller; nothing changes until it's completed. */
  beginTotpReplacement: () =>
    call<{ totp: TotpEnrolment }>("AccessService", "BeginTotpReplacement"),
  /** The caller's new password; the current one is checked first. */
  changePassword: (currentPassword: string, newPassword: string) =>
    call<Record<string, never>>("AccessService", "ChangePassword", {
      currentPassword,
      newPassword,
    }),
  completeTotpReplacement: (enrolmentId: string, totpCode: string) =>
    call<Record<string, never>>("AccessService", "CompleteTotpReplacement", {
      enrolmentId,
      totpCode,
    }),
  /**
   * The box makes an ed25519 key pair for the caller, signed by its root key. The private key
   * is in the answer once and never kept.
   */
  issueSshKey: (label: string, validDays = 0) =>
    call<IssueSshKeyResponse>("AccessService", "IssueSshKey", { label, validDays }),
  list: () => call<ListAdminsResponse>("AccessService", "ListAdmins"),
  /** Clears the admin's password and authenticator, ends their sessions, and gives a new code. */
  reinviteAdmin: (name: string) =>
    call<{ invitation: Invitation }>("AccessService", "ReinviteAdmin", { name }),
  removeAdmin: (name: string) =>
    call<Record<string, never>>("AccessService", "RemoveAdmin", { name }),
  /** Revokes an issued key: its certificate joins the revocation list at once. */
  removeKey: (admin: string, fingerprint: string) =>
    call<Record<string, never>>("AccessService", "RemoveKey", { admin, fingerprint }),
  setAccessPolicy: (policy: AccessPolicy) =>
    call<Record<string, never>>("AccessService", "SetAccessPolicy", { policy }),
  /** The root-operator roster, and the approvals (M) a factory reset needs. */
  setQuorum: (members: string[], required: number) =>
    call<Record<string, never>>("AccessService", "SetQuorum", { members, required }),
  setRole: (name: string, role: Admin["role"]) =>
    call<Record<string, never>>("AccessService", "SetRole", { name, role }),
  unlockAdmin: (name: string) =>
    call<Record<string, never>>("AccessService", "UnlockAdmin", { name }),
  /** Takes a removed key off sshd's revocation list, so it can be added to an admin again. */
  unrevokeKey: (fingerprint: string) =>
    call<Record<string, never>>("AccessService", "UnrevokeKey", { fingerprint }),
};

export const elevation = {
  list: () => call<ListElevationsResponse>("ElevationService", "ListElevations"),
  /** Ends an open root shell at once. */
  terminate: (id: string) =>
    call<Record<string, never>>("ElevationService", "TerminateElevation", { id }),
};

export const rootShell = {
  /** Answers the SSH menu's challenge, with a fresh TOTP code; root operators only. */
  issueCode: (challenge: string, totpCode: string) =>
    call<IssueRootShellCodeResponse>("RootShellService", "IssueRootShellCode", {
      challenge,
      totpCode,
    }),
};

export const network = {
  confirm: (token: string) =>
    call<Record<string, never>>("NetworkService", "ConfirmNetwork", { token }),
  get: () => call<GetNetworkResponse>("NetworkService", "GetNetwork"),
  runChecks: () => call<RunChecksResponse>("NetworkService", "RunChecks"),
  set: (settings: NetdSettings) =>
    call<SetNetworkResponse>("NetworkService", "SetNetwork", { settings }),
};

export const tls = {
  assign: (endpointId: string, certificateId: string) =>
    call<{ endpoint: CertEndpoint }>("TlsService", "AssignCertificate", {
      certificateId,
      endpointId,
    }),
  completeCsr: (csrId: string, certificatePem: string, chainPem = "", rootPem = "") =>
    call<AddedCertificate>("TlsService", "CompleteCsr", {
      certificatePem,
      chainPem,
      csrId,
      rootPem,
    }),
  delete: (certificateId: string) =>
    call<Record<string, never>>("TlsService", "DeleteCertificate", { certificateId }),
  discardCsr: (csrId: string) => call<Record<string, never>>("TlsService", "DiscardCsr", { csrId }),
  generateCsr: (request: GenerateCsrRequest) =>
    call<{ csr: PendingCsr }>("TlsService", "GenerateCsr", request),
  get: () => call<GetCertificateStoreResponse>("TlsService", "GetCertificateStore"),
  /** A PFX (pkcs12, base64, with its password) or PEM; the password is never stored. */
  importCertificate: (request: ImportCertificateRequest) =>
    call<AddedCertificate>("TlsService", "ImportCertificate", request),
  revert: (endpointId: string) =>
    call<{ endpoint: CertEndpoint }>("TlsService", "RevertToSelfSigned", { endpointId }),
};

export const mcp = {
  get: () => call<GetMcpResponse>("McpService", "GetMcp"),
  set: (mcpEnabled: boolean, machineApiEnabled: boolean) =>
    call<Record<string, never>>("McpService", "SetMcp", { machineApiEnabled, mcpEnabled }),
};

export const backup = {
  get: () => call<GetBackupsResponse>("BackupService", "GetBackups"),
  restore: (setId: string) => call<Record<string, never>>("BackupService", "Restore", { setId }),
  run: () => call<Record<string, never>>("BackupService", "RunBackup"),
  setPolicy: (policy: BackupPolicy) =>
    call<Record<string, never>>("BackupService", "SetBackupPolicy", { policy }),
};

export const upgrade = {
  /**
   * Boots the staged base release, or for the product switches to its staged slot and restarts
   * the product services (no reboot). With an override, the named root shell is ended first.
   */
  apply: (elevationOverride?: ElevationOverride, target: UpdateTarget = "UPDATE_TARGET_BASE") =>
    call<Record<string, never>>("UpgradeService", "ApplyUpdate", { elevationOverride, target }),
  /** A base .bin or a product bundle, from the mirror, then the release source if allowed. */
  fetch: (fileName: string) =>
    call<{ source?: string; uploadId: string }>("UpgradeService", "FetchUpdate", { fileName }),
  get: () => call<GetUpgradesResponse>("UpgradeService", "GetUpgrades"),
  /** The stable product versions that fit the running base, newer than the installed one. */
  listProductVersions: () =>
    call<ListProductVersionsResponse>("UpgradeService", "ListProductVersions"),
  revert: (elevationOverride?: ElevationOverride, target: UpdateTarget = "UPDATE_TARGET_BASE") =>
    call<Record<string, never>>("UpgradeService", "RevertUpdate", { elevationOverride, target }),
  setPolicy: (policy: UpgradePolicy) =>
    call<Record<string, never>>("UpgradeService", "SetUpgradePolicy", { policy }),
  /** Verifies the upload's signature, channel and hash, and only then unpacks and stages it. */
  stage: (uploadId: string) =>
    call<{ package: UpdatePackage }>("UpgradeService", "StageUpdate", { uploadId }),
  upload: (file: Blob, onProgress?: (fraction: number) => void) => edge.upload(file, onProgress),
};

export const modules = {
  add: (uploadId: string) =>
    call<Record<string, never>>("ModulesService", "AddModule", { uploadId }),
  list: () => call<ListModulesResponse>("ModulesService", "ListModules"),
};

export const audit = {
  exportLog: () => edge.exportAuditLog(),
  list: (limit = 100, pageToken = "", action = "") =>
    call<ListEventsResponse>("AuditService", "ListEvents", { action, limit, pageToken }),
};

export const power = {
  approveFactoryReset: (id: string) =>
    call<{ factoryReset: FactoryReset }>("PowerService", "ApproveFactoryReset", { id }),
  cancelFactoryReset: (id: string) =>
    call<Record<string, never>>("PowerService", "CancelFactoryReset", { id }),
  /** Ends a session from listSessions: a browser is signed out, an SSH or elevated shell cut. */
  endSession: (id: string) => call<Record<string, never>>("PowerService", "EndSession", { id }),
  get: () => call<GetPowerResponse>("PowerService", "GetPower"),
  /** Every live session on the box: :8443 browsers, SSH shells and elevated shells, oldest first. */
  listSessions: () => call<ListSessionsResponse>("PowerService", "ListSessions"),
  reboot: (forced: boolean, forcedConfirmed: boolean) =>
    call<Record<string, never>>("PowerService", "Reboot", { forced, forcedConfirmed }),
  shutdown: (forced: boolean, forcedConfirmed: boolean) =>
    call<Record<string, never>>("PowerService", "Shutdown", { forced, forcedConfirmed }),
  startFactoryReset: (confirmHostname: string) =>
    call<{ factoryReset: FactoryReset }>("PowerService", "StartFactoryReset", {
      confirmHostname,
    }),
};

export type { ActiveSession, AddonModule, BackupSet, Certificate };
