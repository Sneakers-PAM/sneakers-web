// Typed wrappers over the Connect API, one object per proto service. Thin by design: every
// method just names the service and RPC the proto declares and forwards the request shape.
import { edge } from "@sneakers-web/edge";

import type {
  ActiveSession,
  Admin,
  AddonModule,
  BackupPolicy,
  BackupSet,
  BeginSignInResponse,
  Certificate,
  ElevationOverride,
  ElevationPolicy,
  FactoryReset,
  GetBackupsResponse,
  GetMcpResponse,
  GetNetworkResponse,
  GetPowerResponse,
  GetSetupResponse,
  GetStatusResponse,
  GetTlsResponse,
  GetUpgradesResponse,
  Key,
  ListAdminsResponse,
  ListElevationsResponse,
  ListEventsResponse,
  ListModulesResponse,
  NetdSettings,
  PollSignInResponse,
  RecoveryKey,
  RunChecksResponse,
  Session,
  SetNetworkResponse,
  UpdatePackage,
  UpgradePolicy,
} from "@/lib/osadmin/types";

import { trackRequest } from "@/lib/readiness";

const call = <Result>(service: string, method: string, body: unknown = {}): Promise<Result> =>
  trackRequest(edge.request<Result>(service, method, body));

export const signIn = {
  begin: () => call<BeginSignInResponse>("SignInService", "BeginSignIn"),
  getSession: () => call<{ session?: Session }>("SignInService", "GetSession"),
  poll: (pollToken: string) =>
    call<PollSignInResponse>("SignInService", "PollSignIn", { pollToken }),
  signOut: () => call<Record<string, never>>("SignInService", "SignOut"),
};

export const setup = {
  acknowledgeSingleAdmin: () =>
    call<Record<string, never>>("SetupService", "AcknowledgeSingleAdmin"),
  addRecoveryKey: (publicKey: string, label: string) =>
    call<{ recoveryKey: RecoveryKey }>("SetupService", "AddRecoveryKey", {
      label,
      publicKey,
    }),
  downloadEscrow: () =>
    call<{ content: string; fileName: string }>("SetupService", "DownloadEscrow"),
  finish: () => call<{ productSetupUrl: string }>("SetupService", "Finish"),
  get: () => call<GetSetupResponse>("SetupService", "GetSetup"),
  removeRecoveryKey: (fingerprint: string) =>
    call<Record<string, never>>("SetupService", "RemoveRecoveryKey", { fingerprint }),
};

export const status = {
  get: () => call<GetStatusResponse>("StatusService", "GetStatus"),
  setSecureBoot: (on: boolean, confirmHostname: string) =>
    call<Record<string, never>>("StatusService", "SetSecureBoot", { confirmHostname, on }),
};

export const access = {
  addAdmin: (name: string, role: Admin["role"], publicKey?: string) =>
    call<{ admin: Admin }>("AccessService", "AddAdmin", { name, publicKey, role }),
  addKey: (admin: string, publicKey: string) =>
    call<{ key: Key }>("AccessService", "AddKey", { admin, publicKey }),
  list: () => call<ListAdminsResponse>("AccessService", "ListAdmins"),
  removeAdmin: (name: string) =>
    call<Record<string, never>>("AccessService", "RemoveAdmin", { name }),
  removeKey: (admin: string, fingerprint: string) =>
    call<Record<string, never>>("AccessService", "RemoveKey", { admin, fingerprint }),
  setElevationPolicy: (policy: ElevationPolicy) =>
    call<Record<string, never>>("AccessService", "SetElevationPolicy", { policy }),
  setQuorum: (members: string[], required: number) =>
    call<Record<string, never>>("AccessService", "SetQuorum", { members, required }),
  setRole: (name: string, role: Admin["role"]) =>
    call<Record<string, never>>("AccessService", "SetRole", { name, role }),
};

export const elevation = {
  approve: (id: string, minutes = 0) =>
    call<Record<string, never>>("ElevationService", "ApproveElevation", { id, minutes }),
  deny: (id: string) => call<Record<string, never>>("ElevationService", "DenyElevation", { id }),
  list: () => call<ListElevationsResponse>("ElevationService", "ListElevations"),
  terminate: (id: string) =>
    call<Record<string, never>>("ElevationService", "TerminateElevation", { id }),
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
  createCsr: (names: string[]) =>
    call<{ csrPem: string }>("TlsService", "CreateCsr", { names }),
  get: () => call<GetTlsResponse>("TlsService", "GetTls"),
  setAdminCertificate: (useProduct: boolean) =>
    call<Record<string, never>>("TlsService", "SetAdminCertificate", { useProduct }),
  uploadCertificate: (certificatePem: string, chainPem = "") =>
    call<Record<string, never>>("TlsService", "UploadCertificate", { certificatePem, chainPem }),
};

export const mcp = {
  get: () => call<GetMcpResponse>("McpService", "GetMcp"),
  set: (mcpEnabled: boolean, machineApiEnabled: boolean) =>
    call<Record<string, never>>("McpService", "SetMcp", { machineApiEnabled, mcpEnabled }),
};

export const backup = {
  get: () => call<GetBackupsResponse>("BackupService", "GetBackups"),
  restore: (setId: string) =>
    call<Record<string, never>>("BackupService", "Restore", { setId }),
  run: () => call<Record<string, never>>("BackupService", "RunBackup"),
  setPolicy: (policy: BackupPolicy) =>
    call<Record<string, never>>("BackupService", "SetBackupPolicy", { policy }),
};

export const upgrade = {
  /** With an override, the named elevated shell is ended first (owner, step-up). */
  apply: (elevationOverride?: ElevationOverride) =>
    call<Record<string, never>>("UpgradeService", "ApplyUpdate", { elevationOverride }),
  fetch: (fileName: string) =>
    call<{ uploadId: string }>("UpgradeService", "FetchUpdate", { fileName }),
  get: () => call<GetUpgradesResponse>("UpgradeService", "GetUpgrades"),
  revert: (elevationOverride?: ElevationOverride) =>
    call<Record<string, never>>("UpgradeService", "RevertUpdate", { elevationOverride }),
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
  get: () => call<GetPowerResponse>("PowerService", "GetPower"),
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
