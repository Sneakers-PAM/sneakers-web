/* eslint-disable */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  T | { [P in keyof T]?: P extends " $fragmentName" | "__typename" ? T[P] : never };
import type { DocumentTypeDecoration } from "@graphql-typed-document-node/core";
export type ApprovalStatus = "approved" | "denied" | "pending";

export type ComponentStatus = "NOT_CONFIGURED" | "OK" | "UNAVAILABLE";

export type ConnectionInput = {
  description?: string | null | undefined;
  id?: string | null | undefined;
  name: string;
  port?: number | null | undefined;
  protocol: string;
  useTls?: boolean | null | undefined;
};

export type CreateSecretInput = {
  expiresAt?: string | null | undefined;
  fields: Array<KeyValueInput>;
  folderId: string;
  name: string;
  targetId?: string | null | undefined;
  typeId: string;
};

export type DependencyHealth = "DEGRADED" | "DOWN" | "OK";

export type FactorInput = {
  code?: string | null | undefined;
  credentialJson?: string | null | undefined;
  kind: string;
  webauthnSessionId?: string | null | undefined;
};

export type FieldKind =
  "boolean" | "file" | "multiline" | "password" | "select" | "sensitive" | "text";

export type FolderScope = "group" | "personal" | "role";

export type HeartbeatResult =
  "failed" | "hostKeyMismatch" | "hostKeyNotPinned" | "ok" | "unknown" | "unreachable";

export type KeyValueInput = {
  key: string;
  value: string;
};

export type PasswordPolicyInput = {
  endLiteral?: string | null | undefined;
  excludeChars?: string | null | undefined;
  id?: string | null | undefined;
  maxLength?: number | null | undefined;
  minLength: number;
  name: string;
  requireDigit: boolean;
  requireLower: boolean;
  requireSymbol: boolean;
  requireUpper: boolean;
  rotationDays?: number | null | undefined;
  startClass?: PwStartClass | null | undefined;
};

export type PolicyEnforcement = "lax" | "strict";

export type PwStartClass = "any" | "digit" | "letter" | "symbol";

export type RaciAction = "A" | "C" | "I" | "R";

export type RaciGrant = "allow" | "deny";

export type RaciRuleGrantInput = {
  action: RaciAction;
  value: RaciGrant;
};

export type RaciRuleInput = {
  grants: Array<RaciRuleGrantInput>;
  subjectId?: string | null | undefined;
  subjectKind: SubjectKind;
  subjectName: string;
};

export type RequestKind = "folder_move" | "secret_access" | "secret_move";

export type RotationState = "degraded" | "failed" | "ok" | "rotating" | "unknown";

export type SecretFieldDefInput = {
  defaultValue?: string | null | undefined;
  key: string;
  kind: FieldKind;
  label: string;
  maxLength?: number | null | undefined;
  options?: Array<string> | null | undefined;
  pattern?: string | null | undefined;
  policyEnforcement?: PolicyEnforcement | null | undefined;
  policyId?: string | null | undefined;
  required?: boolean | null | undefined;
  rotates?: boolean | null | undefined;
  sensitive?: boolean | null | undefined;
  superSensitive?: boolean | null | undefined;
};

export type SecretTypeInput = {
  checkout?: boolean | null | undefined;
  fields: Array<SecretFieldDefInput>;
  heartbeat?: boolean | null | undefined;
  name: string;
  rotation?: boolean | null | undefined;
};

export type SecretUseDecision = "APPROVE" | "DENY";

export type SecretUseRefusal =
  | "ALREADY_DECIDED"
  | "EXPIRED"
  | "NOT_FOUND"
  | "NOT_PERMITTED"
  | "NO_APPROVER"
  | "OTHER_APPROVER"
  | "SELF_APPROVAL"
  | "UNAVAILABLE";

export type SecuritySettingsInput = {
  allowApiForSensitive?: boolean | null | undefined;
  defaultPasswordPolicyId?: string | null | undefined;
  requestHistoryRetentionDays?: number | null | undefined;
  requireMfaForReveal?: boolean | null | undefined;
  requireMfaForSensitiveCheckout?: boolean | null | undefined;
  sessionTtlSeconds?: number | null | undefined;
};

export type StepUpMode = "inherit" | "off" | "require";

export type SubjectKind = "everyone" | "group" | "user";

export type TargetConnectionInput = {
  connectionId: string;
  isDefault: boolean;
};

export type TargetInput = {
  connectionId?: string | null | undefined;
  connections?: Array<TargetConnectionInput> | null | undefined;
  description?: string | null | undefined;
  domain?: string | null | undefined;
  hostname: string;
  id?: string | null | undefined;
  kind?: string | null | undefined;
  name: string;
  realm?: string | null | undefined;
  sshHostKeys?: Array<string> | null | undefined;
};

export type TypeOrigin = "custom" | "extension" | "system";

export type UpdateSecretInput = {
  expiresAt?: string | null | undefined;
  fields?: Array<KeyValueInput> | null | undefined;
  folderId?: string | null | undefined;
  name?: string | null | undefined;
  targetId?: string | null | undefined;
};

export type UseGrantInput = {
  allowReveal?: boolean | null | undefined;
  expiresAtUnix: number;
  fieldKeys?: Array<string> | null | undefined;
  folderId?: string | null | undefined;
  maxUses?: number | null | undefined;
  programs: Array<UseGrantProgramInput>;
  secretIds?: Array<string> | null | undefined;
  tokenId: string;
};

export type UseGrantProgramInput = {
  argPattern: string;
  program: string;
};

export type AuditRecordFieldsFragment = {
  seq: number;
  tier: string;
  action: string;
  actorUserId: string;
  actorName: string;
  subject: string;
  subjectKind: string;
  subjectId: string;
  subjectName: string | null;
  groupId: string;
  sensitive: boolean;
  occurredAt: string;
  prevHash: string;
  hash: string;
  attributes: Array<{ key: string; value: string }>;
};

export type AdminAuditQueryVariables = Exact<{
  actorUserId?: string | null | undefined;
  subject?: string | null | undefined;
  excludeActions?: Array<string> | string | null | undefined;
  limit?: number | null | undefined;
}>;

export type AdminAuditQuery = {
  auditActions: Array<string>;
  auditRecords: Array<{
    seq: number;
    tier: string;
    action: string;
    actorUserId: string;
    actorName: string;
    subject: string;
    subjectKind: string;
    subjectId: string;
    subjectName: string | null;
    groupId: string;
    sensitive: boolean;
    occurredAt: string;
    prevHash: string;
    hash: string;
    attributes: Array<{ key: string; value: string }>;
  }>;
  auditChain: { valid: boolean; brokenAtSeq: number; length: number };
  users: Array<{ id: string; name: string; username: string }>;
  groups: Array<{ id: string; name: string }>;
};

export type AdminBreakGlassSessionsQueryVariables = Exact<{
  limit?: number | null | undefined;
}>;

export type AdminBreakGlassSessionsQuery = {
  breakGlassSessions: Array<{
    id: string;
    actorUserId: string;
    actorName: string;
    reason: string;
    openedAt: string;
    expiresAt: string;
    endedAt: string | null;
    endReason: string | null;
    reveals: Array<{
      eventId: string;
      secretId: string;
      secretName: string;
      revealedAt: string;
      postRotationScheduled: boolean;
      ownerNotified: boolean;
    }>;
  }>;
};

export type AdminFolderSettingsQueryVariables = Exact<{ [key: string]: never }>;

export type AdminFolderSettingsQuery = {
  folders: Array<{ id: string; revealStepUp: StepUpMode }>;
  securitySettings: { requireMfaForReveal: boolean };
  users: Array<{ id: string; name: string }>;
};

export type AdminSetFolderRevealStepUpMutationVariables = Exact<{
  folderId: string;
  mode: StepUpMode;
}>;

export type AdminSetFolderRevealStepUpMutation = {
  setFolderRevealStepUp: { id: string; revealStepUp: StepUpMode };
};

export type ServiceAccountFieldsFragment = {
  id: string;
  name: string;
  description: string;
  disabled: boolean;
  createdBy: string;
  createdAtUnix: number;
  oidcIssuer: string | null;
  oidcSubject: string | null;
  oidcAllowedGroups: Array<string>;
};

export type ApiTokenFieldsFragment = {
  id: string;
  serviceAccountId: string;
  scope: string;
  expiresAtUnix: number;
  revokedAtUnix: number;
  lastUsedAtUnix: number;
  createdBy: string;
};

export type AdminServiceAccountsQueryVariables = Exact<{ [key: string]: never }>;

export type AdminServiceAccountsQuery = {
  serviceAccounts: Array<{
    id: string;
    name: string;
    description: string;
    disabled: boolean;
    createdBy: string;
    createdAtUnix: number;
    oidcIssuer: string | null;
    oidcSubject: string | null;
    oidcAllowedGroups: Array<string>;
  }>;
  users: Array<{ id: string; name: string }>;
};

export type AdminServiceAccountQueryVariables = Exact<{
  id: string;
}>;

export type AdminServiceAccountQuery = {
  serviceAccounts: Array<{
    id: string;
    name: string;
    description: string;
    disabled: boolean;
    createdBy: string;
    createdAtUnix: number;
    oidcIssuer: string | null;
    oidcSubject: string | null;
    oidcAllowedGroups: Array<string>;
  }>;
  apiTokens: Array<{
    id: string;
    serviceAccountId: string;
    scope: string;
    expiresAtUnix: number;
    revokedAtUnix: number;
    lastUsedAtUnix: number;
    createdBy: string;
  }>;
  groups: Array<{ id: string; name: string }>;
  users: Array<{ id: string; name: string }>;
};

export type AdminCreateServiceAccountMutationVariables = Exact<{
  name: string;
  description: string;
}>;

export type AdminCreateServiceAccountMutation = { createServiceAccount: { id: string } };

export type AdminDisableServiceAccountMutationVariables = Exact<{
  id: string;
}>;

export type AdminDisableServiceAccountMutation = {
  disableServiceAccount: { id: string; disabled: boolean };
};

export type AdminMintApiTokenMutationVariables = Exact<{
  serviceAccountId: string;
  scope: string;
  expiresAt?: number | null | undefined;
}>;

export type AdminMintApiTokenMutation = {
  mintApiToken: {
    token: string;
    apiToken: {
      id: string;
      serviceAccountId: string;
      scope: string;
      expiresAtUnix: number;
      revokedAtUnix: number;
      lastUsedAtUnix: number;
      createdBy: string;
    };
  };
};

export type AdminRevokeApiTokenMutationVariables = Exact<{
  id: string;
}>;

export type AdminRevokeApiTokenMutation = { revokeApiToken: { id: string; revokedAtUnix: number } };

export type AdminLinkOidcClientMutationVariables = Exact<{
  serviceAccountId: string;
  oidcSubject: string;
  allowedGroups: Array<string> | string;
}>;

export type AdminLinkOidcClientMutation = {
  linkOidcClient: {
    id: string;
    name: string;
    description: string;
    disabled: boolean;
    createdBy: string;
    createdAtUnix: number;
    oidcIssuer: string | null;
    oidcSubject: string | null;
    oidcAllowedGroups: Array<string>;
  };
};

export type AdminUnlinkOidcClientMutationVariables = Exact<{
  serviceAccountId: string;
}>;

export type AdminUnlinkOidcClientMutation = {
  unlinkOidcClient: {
    id: string;
    name: string;
    description: string;
    disabled: boolean;
    createdBy: string;
    createdAtUnix: number;
    oidcIssuer: string | null;
    oidcSubject: string | null;
    oidcAllowedGroups: Array<string>;
  };
};

export type SecretTypeFieldsFragment = {
  id: string;
  name: string;
  heartbeat: boolean | null;
  checkout: boolean | null;
  rotation: boolean | null;
  origin: TypeOrigin;
  vendor: string | null;
  fields: Array<{
    key: string;
    label: string;
    kind: FieldKind;
    options: Array<string> | null;
    defaultValue: string | null;
    required: boolean | null;
    sensitive: boolean | null;
    policyId: string | null;
    policyEnforcement: PolicyEnforcement | null;
    rotates: boolean | null;
    superSensitive: boolean | null;
    pattern: string | null;
    maxLength: number | null;
  }>;
};

export type PasswordPolicyFieldsFragment = {
  id: string;
  name: string;
  minLength: number;
  maxLength: number | null;
  requireUpper: boolean;
  requireLower: boolean;
  requireDigit: boolean;
  requireSymbol: boolean;
  rotationDays: number | null;
  startClass: PwStartClass | null;
  endLiteral: string | null;
  excludeChars: string | null;
  isDefault: boolean;
  byTypeFields: number;
  deletable: boolean;
};

export type SecuritySettingsFieldsFragment = {
  defaultPasswordPolicyId: string | null;
  requireMfaForSensitiveCheckout: boolean;
  allowApiForSensitive: boolean;
  requestHistoryRetentionDays: number | null;
  sessionTtlSeconds: number | null;
  requireMfaForReveal: boolean;
};

export type AdminSecretTypesQueryVariables = Exact<{ [key: string]: never }>;

export type AdminSecretTypesQuery = {
  secretTypes: Array<{
    id: string;
    name: string;
    heartbeat: boolean | null;
    checkout: boolean | null;
    rotation: boolean | null;
    origin: TypeOrigin;
    vendor: string | null;
    fields: Array<{
      key: string;
      label: string;
      kind: FieldKind;
      options: Array<string> | null;
      defaultValue: string | null;
      required: boolean | null;
      sensitive: boolean | null;
      policyId: string | null;
      policyEnforcement: PolicyEnforcement | null;
      rotates: boolean | null;
      superSensitive: boolean | null;
      pattern: string | null;
      maxLength: number | null;
    }>;
  }>;
  availableExtensions: Array<{
    id: string;
    name: string;
    vendor: string | null;
    fields: Array<{ label: string }>;
  }>;
};

export type AdminSecretTypeQueryVariables = Exact<{ [key: string]: never }>;

export type AdminSecretTypeQuery = {
  secretTypes: Array<{
    id: string;
    name: string;
    heartbeat: boolean | null;
    checkout: boolean | null;
    rotation: boolean | null;
    origin: TypeOrigin;
    vendor: string | null;
    fields: Array<{
      key: string;
      label: string;
      kind: FieldKind;
      options: Array<string> | null;
      defaultValue: string | null;
      required: boolean | null;
      sensitive: boolean | null;
      policyId: string | null;
      policyEnforcement: PolicyEnforcement | null;
      rotates: boolean | null;
      superSensitive: boolean | null;
      pattern: string | null;
      maxLength: number | null;
    }>;
  }>;
  passwordPolicies: Array<{
    id: string;
    name: string;
    minLength: number;
    maxLength: number | null;
    isDefault: boolean;
  }>;
};

export type AdminCreateSecretTypeMutationVariables = Exact<{
  input: SecretTypeInput;
}>;

export type AdminCreateSecretTypeMutation = {
  createSecretType: {
    id: string;
    name: string;
    heartbeat: boolean | null;
    checkout: boolean | null;
    rotation: boolean | null;
    origin: TypeOrigin;
    vendor: string | null;
    fields: Array<{
      key: string;
      label: string;
      kind: FieldKind;
      options: Array<string> | null;
      defaultValue: string | null;
      required: boolean | null;
      sensitive: boolean | null;
      policyId: string | null;
      policyEnforcement: PolicyEnforcement | null;
      rotates: boolean | null;
      superSensitive: boolean | null;
      pattern: string | null;
      maxLength: number | null;
    }>;
  };
};

export type AdminUpdateSecretTypeMutationVariables = Exact<{
  id: string;
  input: SecretTypeInput;
}>;

export type AdminUpdateSecretTypeMutation = {
  updateSecretType: {
    id: string;
    name: string;
    heartbeat: boolean | null;
    checkout: boolean | null;
    rotation: boolean | null;
    origin: TypeOrigin;
    vendor: string | null;
    fields: Array<{
      key: string;
      label: string;
      kind: FieldKind;
      options: Array<string> | null;
      defaultValue: string | null;
      required: boolean | null;
      sensitive: boolean | null;
      policyId: string | null;
      policyEnforcement: PolicyEnforcement | null;
      rotates: boolean | null;
      superSensitive: boolean | null;
      pattern: string | null;
      maxLength: number | null;
    }>;
  };
};

export type AdminDeleteSecretTypeMutationVariables = Exact<{
  id: string;
}>;

export type AdminDeleteSecretTypeMutation = { deleteSecretType: boolean };

export type AdminCloneSecretTypeMutationVariables = Exact<{
  id: string;
}>;

export type AdminCloneSecretTypeMutation = { cloneSecretType: { id: string; name: string } };

export type AdminImportExtensionMutationVariables = Exact<{
  id: string;
}>;

export type AdminImportExtensionMutation = { importExtension: { id: string; name: string } };

export type AdminImportExtensionFromJsonMutationVariables = Exact<{
  json: string;
}>;

export type AdminImportExtensionFromJsonMutation = {
  importExtensionFromJson: { id: string; name: string };
};

export type AdminPoliciesQueryVariables = Exact<{ [key: string]: never }>;

export type AdminPoliciesQuery = {
  passwordPolicies: Array<{
    id: string;
    name: string;
    minLength: number;
    maxLength: number | null;
    requireUpper: boolean;
    requireLower: boolean;
    requireDigit: boolean;
    requireSymbol: boolean;
    rotationDays: number | null;
    startClass: PwStartClass | null;
    endLiteral: string | null;
    excludeChars: string | null;
    isDefault: boolean;
    byTypeFields: number;
    deletable: boolean;
  }>;
  securitySettings: {
    defaultPasswordPolicyId: string | null;
    requireMfaForSensitiveCheckout: boolean;
    allowApiForSensitive: boolean;
    requestHistoryRetentionDays: number | null;
    sessionTtlSeconds: number | null;
    requireMfaForReveal: boolean;
  };
};

export type AdminSavePasswordPolicyMutationVariables = Exact<{
  input: PasswordPolicyInput;
}>;

export type AdminSavePasswordPolicyMutation = {
  savePasswordPolicy: {
    id: string;
    name: string;
    minLength: number;
    maxLength: number | null;
    requireUpper: boolean;
    requireLower: boolean;
    requireDigit: boolean;
    requireSymbol: boolean;
    rotationDays: number | null;
    startClass: PwStartClass | null;
    endLiteral: string | null;
    excludeChars: string | null;
    isDefault: boolean;
    byTypeFields: number;
    deletable: boolean;
  };
};

export type AdminDeletePasswordPolicyMutationVariables = Exact<{
  id: string;
}>;

export type AdminDeletePasswordPolicyMutation = { deletePasswordPolicy: boolean };

export type AdminUpdateSecuritySettingsMutationVariables = Exact<{
  input: SecuritySettingsInput;
}>;

export type AdminUpdateSecuritySettingsMutation = {
  updateSecuritySettings: {
    defaultPasswordPolicyId: string | null;
    requireMfaForSensitiveCheckout: boolean;
    allowApiForSensitive: boolean;
    requestHistoryRetentionDays: number | null;
    sessionTtlSeconds: number | null;
    requireMfaForReveal: boolean;
  };
};

export type AdminRaciRuleFieldsFragment = {
  id: string;
  subjectKind: SubjectKind;
  subjectName: string;
  subjectId: string | null;
  grants: Array<{ action: RaciAction; value: RaciGrant }>;
};

export type AdminFolderRulesetQueryVariables = Exact<{
  folderId: string;
}>;

export type AdminFolderRulesetQuery = {
  folderRuleset: {
    folderId: string;
    owners: Array<string>;
    rules: Array<{
      id: string;
      subjectKind: SubjectKind;
      subjectName: string;
      subjectId: string | null;
      grants: Array<{ action: RaciAction; value: RaciGrant }>;
    }>;
    inherited: Array<{
      fromFolderId: string;
      fromFolderName: string;
      rule: {
        id: string;
        subjectKind: SubjectKind;
        subjectName: string;
        subjectId: string | null;
        grants: Array<{ action: RaciAction; value: RaciGrant }>;
      };
    }>;
    inheritedOwners: Array<{ userId: string; fromFolderId: string; fromFolderName: string }>;
  };
  groups: Array<{ id: string; name: string }>;
  users: Array<{ id: string; name: string }>;
};

export type AdminSetFolderRulesetMutationVariables = Exact<{
  folderId: string;
  owners: Array<string> | string;
  rules: Array<RaciRuleInput> | RaciRuleInput;
}>;

export type AdminSetFolderRulesetMutation = { setFolderRuleset: { folderId: string } };

export type ConnectionFieldsFragment = {
  id: string;
  name: string;
  protocol: string;
  port: number | null;
  useTls: boolean | null;
  description: string | null;
  targetCount: number;
};

export type TargetFieldsFragment = {
  id: string;
  name: string;
  hostname: string;
  kind: string | null;
  domain: string | null;
  realm: string | null;
  connectionId: string;
  description: string | null;
  secretCount: number;
  ownerUserId: string | null;
  sshHostKeys: Array<string>;
};

export type AdminConnectionsQueryVariables = Exact<{ [key: string]: never }>;

export type AdminConnectionsQuery = {
  connections: Array<{
    id: string;
    name: string;
    protocol: string;
    port: number | null;
    useTls: boolean | null;
    description: string | null;
    targetCount: number;
  }>;
  targets: Array<{ id: string; name: string; connectionId: string }>;
};

export type AdminSaveConnectionMutationVariables = Exact<{
  input: ConnectionInput;
}>;

export type AdminSaveConnectionMutation = {
  saveConnection: {
    id: string;
    name: string;
    protocol: string;
    port: number | null;
    useTls: boolean | null;
    description: string | null;
    targetCount: number;
  };
};

export type AdminDeleteConnectionMutationVariables = Exact<{
  id: string;
}>;

export type AdminDeleteConnectionMutation = { deleteConnection: boolean };

export type AdminTargetsQueryVariables = Exact<{ [key: string]: never }>;

export type AdminTargetsQuery = {
  targets: Array<{
    id: string;
    name: string;
    hostname: string;
    kind: string | null;
    domain: string | null;
    realm: string | null;
    connectionId: string;
    description: string | null;
    secretCount: number;
    ownerUserId: string | null;
    sshHostKeys: Array<string>;
  }>;
  connections: Array<{ id: string; name: string; protocol: string; port: number | null }>;
};

export type AdminSaveTargetMutationVariables = Exact<{
  input: TargetInput;
}>;

export type AdminSaveTargetMutation = {
  saveTarget: {
    id: string;
    name: string;
    hostname: string;
    kind: string | null;
    domain: string | null;
    realm: string | null;
    connectionId: string;
    description: string | null;
    secretCount: number;
    ownerUserId: string | null;
    sshHostKeys: Array<string>;
  };
};

export type AdminDeleteTargetMutationVariables = Exact<{
  id: string;
}>;

export type AdminDeleteTargetMutation = { deleteTarget: boolean };

export type AdminUsersQueryVariables = Exact<{ [key: string]: never }>;

export type AdminUsersQuery = {
  users: Array<{
    id: string;
    name: string;
    username: string;
    email: string;
    roles: Array<string>;
    isRoot: boolean;
    emailVerified: boolean;
    disabled: boolean;
  }>;
};

export type AdminUserQueryVariables = Exact<{
  id: string;
}>;

export type AdminUserQuery = {
  user: {
    subject: string;
    id: string;
    name: string;
    username: string;
    email: string;
    roles: Array<string>;
    isRoot: boolean;
    emailVerified: boolean;
    disabled: boolean;
  } | null;
  userGroups: Array<{ id: string; name: string }>;
  groups: Array<{ id: string; name: string }>;
  userTokens: Array<{
    id: string;
    label: string;
    clientName: string;
    createdAtUnix: number;
    lastUsedAtUnix: number;
    expiresAtUnix: number;
    revokedAtUnix: number;
  }>;
};

export type AdminCreateLocalUserMutationVariables = Exact<{
  username: string;
  email: string;
  name: string;
  password: string;
}>;

export type AdminCreateLocalUserMutation = { createLocalUser: { id: string } };

export type AdminUpdateUserMutationVariables = Exact<{
  userId: string;
  name: string;
  email: string;
  username: string;
}>;

export type AdminUpdateUserMutation = {
  updateUser: {
    id: string;
    name: string;
    username: string;
    email: string;
    roles: Array<string>;
    isRoot: boolean;
    emailVerified: boolean;
    disabled: boolean;
  };
};

export type AdminSetUserRolesMutationVariables = Exact<{
  userId: string;
  roles: Array<string> | string;
}>;

export type AdminSetUserRolesMutation = {
  setUserRoles: {
    id: string;
    name: string;
    username: string;
    email: string;
    roles: Array<string>;
    isRoot: boolean;
    emailVerified: boolean;
    disabled: boolean;
  };
};

export type AdminSetUserDisabledMutationVariables = Exact<{
  userId: string;
  disabled: boolean;
}>;

export type AdminSetUserDisabledMutation = {
  setUserDisabled: {
    id: string;
    name: string;
    username: string;
    email: string;
    roles: Array<string>;
    isRoot: boolean;
    emailVerified: boolean;
    disabled: boolean;
  };
};

export type AdminRequestEmailVerificationMutationVariables = Exact<{
  userId: string;
}>;

export type AdminRequestEmailVerificationMutation = { requestEmailVerification: boolean };

export type AdminConfirmEmailVerificationMutationVariables = Exact<{
  userId: string;
  code: string;
}>;

export type AdminConfirmEmailVerificationMutation = { confirmEmailVerification: boolean };

export type AdminRevokeUserTokenMutationVariables = Exact<{
  userId: string;
  id: string;
}>;

export type AdminRevokeUserTokenMutation = {
  revokeUserToken: { id: string; revokedAtUnix: number };
};

export type AdminGroupsQueryVariables = Exact<{ [key: string]: never }>;

export type AdminGroupsQuery = { groups: Array<{ id: string; name: string }> };

export type AdminGroupQueryVariables = Exact<{
  id: string;
}>;

export type AdminGroupQuery = {
  groups: Array<{ id: string; name: string }>;
  groupMembers: Array<{ id: string; name: string; email: string; username: string }>;
};

export type AdminSearchUsersQueryVariables = Exact<{
  query: string;
  limit?: number | null | undefined;
}>;

export type AdminSearchUsersQuery = {
  searchUsers: Array<{ id: string; name: string; email: string; username: string }>;
};

export type AdminCreateGroupMutationVariables = Exact<{
  name: string;
}>;

export type AdminCreateGroupMutation = { createGroup: { id: string; name: string } };

export type AdminAddGroupMemberMutationVariables = Exact<{
  userId: string;
  groupId: string;
}>;

export type AdminAddGroupMemberMutation = { addGroupMember: boolean };

export type AdminRemoveGroupMemberMutationVariables = Exact<{
  userId: string;
  groupId: string;
}>;

export type AdminRemoveGroupMemberMutation = { removeGroupMember: boolean };

export type UserFieldsFragment = {
  id: string;
  name: string;
  username: string;
  email: string;
  roles: Array<string>;
  isRoot: boolean;
  emailVerified: boolean;
  disabled: boolean;
};

export type MeQueryVariables = Exact<{
  id: string;
}>;

export type MeQuery = {
  user: {
    id: string;
    name: string;
    username: string;
    email: string;
    roles: Array<string>;
    isRoot: boolean;
    emailVerified: boolean;
    disabled: boolean;
  } | null;
};

export type ShellCountsQueryVariables = Exact<{
  userId: string;
}>;

export type ShellCountsQuery = {
  activeLeasesForUser: Array<{ id: string; secretId: string; expiresAt: string }>;
  approvalRequests: Array<{ id: string; status: ApprovalStatus; requestedByUserId: string }>;
  pendingSecretUses: Array<{ id: string }>;
};

export type MyNotificationsQueryVariables = Exact<{
  limit?: number | null | undefined;
}>;

export type MyNotificationsQuery = {
  myUnreadNotificationCount: number;
  myNotifications: Array<{
    id: string;
    action: string;
    resourceKind: string;
    resourceId: string;
    resourceLabel: string;
    actorLabel: string;
    occurredAt: string;
    read: boolean;
  }>;
};

export type UnreadCountQueryVariables = Exact<{ [key: string]: never }>;

export type UnreadCountQuery = { myUnreadNotificationCount: number };

export type MarkNotificationReadMutationVariables = Exact<{
  id: string;
}>;

export type MarkNotificationReadMutation = { markNotificationRead: boolean };

export type MarkAllNotificationsReadMutationVariables = Exact<{ [key: string]: never }>;

export type MarkAllNotificationsReadMutation = { markAllNotificationsRead: boolean };

export type ApplianceStatusQueryVariables = Exact<{ [key: string]: never }>;

export type ApplianceStatusQuery = {
  appliance: { maintenance: boolean; maintenanceReason: string | null; mcp: string | null };
};

export type DiagnosticsQueryVariables = Exact<{ [key: string]: never }>;

export type DiagnosticsQuery = {
  diagnostics: {
    generatedAt: string;
    traceId: string;
    publicUrl: string;
    appliance: string | null;
    actor: { id: string; username: string; roles: Array<string> };
    gateway: {
      name: string;
      version: string | null;
      commit: string | null;
      status: ComponentStatus;
      dependencies: Array<{
        name: string;
        state: DependencyHealth;
        required: boolean;
        error: string | null;
        version: string | null;
      }> | null;
    };
    services: Array<{
      name: string;
      version: string | null;
      commit: string | null;
      status: ComponentStatus;
      dependencies: Array<{
        name: string;
        state: DependencyHealth;
        required: boolean;
        error: string | null;
        version: string | null;
      }> | null;
    }>;
    thirdParty: Array<{
      name: string;
      version: string | null;
      commit: string | null;
      status: ComponentStatus;
      dependencies: Array<{
        name: string;
        state: DependencyHealth;
        required: boolean;
        error: string | null;
        version: string | null;
      }> | null;
    }>;
  };
};

export type ComponentVersionFieldsFragment = {
  name: string;
  version: string | null;
  commit: string | null;
  status: ComponentStatus;
  dependencies: Array<{
    name: string;
    state: DependencyHealth;
    required: boolean;
    error: string | null;
    version: string | null;
  }> | null;
};

export type BreakGlassCurrentQueryVariables = Exact<{ [key: string]: never }>;

export type BreakGlassCurrentQuery = {
  breakGlassSession: { id: string; reason: string; openedAt: string; expiresAt: string } | null;
};

export type BreakGlassExitMutationVariables = Exact<{
  id: string;
}>;

export type BreakGlassExitMutation = {
  closeBreakGlassSession: { id: string; endedAt: string | null; endReason: string | null };
};

export type AgentsTokenFieldsFragment = {
  id: string;
  label: string;
  clientName: string;
  createdAtUnix: number;
  lastUsedAtUnix: number;
  expiresAtUnix: number;
  revokedAtUnix: number;
};

export type AgentsUseFieldsFragment = {
  id: string;
  secretName: string;
  fieldKey: string;
  argv: Array<string>;
  clientLabel: string;
  state: string;
  expiresAtUnix: number;
  reveal: boolean;
  runId: string | null;
  confirm: boolean;
  requestedBy: string;
};

export type AgentsGrantFieldsFragment = {
  id: string;
  tokenId: string;
  secretIds: Array<string>;
  folderId: string | null;
  fieldKeys: Array<string>;
  expiresAtUnix: number;
  maxUses: number;
  uses: number;
  revokedAtUnix: number;
  allowReveal: boolean;
  programs: Array<{ program: string; argPattern: string }>;
};

export type AgentsTokensQueryVariables = Exact<{ [key: string]: never }>;

export type AgentsTokensQuery = {
  myTokens: Array<{
    id: string;
    label: string;
    clientName: string;
    createdAtUnix: number;
    lastUsedAtUnix: number;
    expiresAtUnix: number;
    revokedAtUnix: number;
  }>;
};

export type AgentsRevokeTokenMutationVariables = Exact<{
  id: string;
}>;

export type AgentsRevokeTokenMutation = {
  revokeMyToken: {
    id: string;
    label: string;
    clientName: string;
    createdAtUnix: number;
    lastUsedAtUnix: number;
    expiresAtUnix: number;
    revokedAtUnix: number;
  };
};

export type AgentsPendingUsesQueryVariables = Exact<{ [key: string]: never }>;

export type AgentsPendingUsesQuery = {
  secretUsesToDecide: Array<{
    id: string;
    secretName: string;
    fieldKey: string;
    argv: Array<string>;
    clientLabel: string;
    state: string;
    expiresAtUnix: number;
    reveal: boolean;
    runId: string | null;
    confirm: boolean;
    requestedBy: string;
  }>;
  pendingSecretUses: Array<{
    id: string;
    secretName: string;
    fieldKey: string;
    argv: Array<string>;
    clientLabel: string;
    state: string;
    expiresAtUnix: number;
    reveal: boolean;
    runId: string | null;
    confirm: boolean;
    requestedBy: string;
  }>;
};

export type AgentsDecideUseMutationVariables = Exact<{
  id: string;
  approve: boolean;
  factor?: FactorInput | null | undefined;
}>;

export type AgentsDecideUseMutation = {
  decideSecretUse: {
    id: string;
    secretName: string;
    fieldKey: string;
    argv: Array<string>;
    clientLabel: string;
    state: string;
    expiresAtUnix: number;
    reveal: boolean;
    runId: string | null;
    confirm: boolean;
    requestedBy: string;
  };
};

export type AgentsGrantsQueryVariables = Exact<{ [key: string]: never }>;

export type AgentsGrantsQuery = {
  useGrants: Array<{
    id: string;
    tokenId: string;
    secretIds: Array<string>;
    folderId: string | null;
    fieldKeys: Array<string>;
    expiresAtUnix: number;
    maxUses: number;
    uses: number;
    revokedAtUnix: number;
    allowReveal: boolean;
    programs: Array<{ program: string; argPattern: string }>;
  }>;
  myTokens: Array<{
    id: string;
    label: string;
    clientName: string;
    createdAtUnix: number;
    lastUsedAtUnix: number;
    expiresAtUnix: number;
    revokedAtUnix: number;
  }>;
  folders: Array<{ id: string; name: string; parentId: string | null }>;
  secretsByStatus: Array<{ id: string; name: string; folderId: string; typeId: string }>;
  secretTypes: Array<{
    id: string;
    fields: Array<{ key: string; label: string; sensitive: boolean | null }>;
  }>;
};

export type AgentsCreateGrantMutationVariables = Exact<{
  input: UseGrantInput;
  factor: FactorInput;
}>;

export type AgentsCreateGrantMutation = {
  createUseGrant: {
    id: string;
    tokenId: string;
    secretIds: Array<string>;
    folderId: string | null;
    fieldKeys: Array<string>;
    expiresAtUnix: number;
    maxUses: number;
    uses: number;
    revokedAtUnix: number;
    allowReveal: boolean;
    programs: Array<{ program: string; argPattern: string }>;
  };
};

export type AgentsRevokeGrantMutationVariables = Exact<{
  id: string;
}>;

export type AgentsRevokeGrantMutation = {
  revokeUseGrant: {
    id: string;
    tokenId: string;
    secretIds: Array<string>;
    folderId: string | null;
    fieldKeys: Array<string>;
    expiresAtUnix: number;
    maxUses: number;
    uses: number;
    revokedAtUnix: number;
    allowReveal: boolean;
    programs: Array<{ program: string; argPattern: string }>;
  };
};

export type AgentsSendFactorEmailMutationVariables = Exact<{ [key: string]: never }>;

export type AgentsSendFactorEmailMutation = { sendMfaEmailCode: boolean };

export type AgentsBeginFactorPasskeyMutationVariables = Exact<{ [key: string]: never }>;

export type AgentsBeginFactorPasskeyMutation = {
  beginMfaPasskey: { options: string; webauthnSessionId: string };
};

export type AgentsRunUseFieldsFragment = {
  purpose: string;
  requester: string;
  id: string;
  secretName: string;
  fieldKey: string;
  argv: Array<string>;
  clientLabel: string;
  state: string;
  expiresAtUnix: number;
  reveal: boolean;
  runId: string | null;
  confirm: boolean;
  requestedBy: string;
};

export type AgentsUseRunQueryVariables = Exact<{
  runId: string;
}>;

export type AgentsUseRunQuery = {
  secretUseRun: {
    runId: string;
    mfaFreshUntilUnix: number;
    uses: Array<{
      purpose: string;
      requester: string;
      id: string;
      secretName: string;
      fieldKey: string;
      argv: Array<string>;
      clientLabel: string;
      state: string;
      expiresAtUnix: number;
      reveal: boolean;
      runId: string | null;
      confirm: boolean;
      requestedBy: string;
    }>;
  };
};

export type AgentsDecideUsesMutationVariables = Exact<{
  ids: Array<string> | string;
  decision: SecretUseDecision;
  factor?: FactorInput | null | undefined;
}>;

export type AgentsDecideUsesMutation = {
  decideSecretUses: {
    outcomes: Array<{
      id: string;
      decided: boolean;
      reason: SecretUseRefusal | null;
      use: {
        purpose: string;
        requester: string;
        id: string;
        secretName: string;
        fieldKey: string;
        argv: Array<string>;
        clientLabel: string;
        state: string;
        expiresAtUnix: number;
        reveal: boolean;
        runId: string | null;
        confirm: boolean;
        requestedBy: string;
      } | null;
    }>;
  };
};

export type AgentsConfirmUsesMutationVariables = Exact<{
  ids: Array<string> | string;
  factor?: FactorInput | null | undefined;
}>;

export type AgentsConfirmUsesMutation = {
  confirmSecretUses: {
    outcomes: Array<{
      id: string;
      decided: boolean;
      reason: SecretUseRefusal | null;
      use: {
        purpose: string;
        requester: string;
        id: string;
        secretName: string;
        fieldKey: string;
        argv: Array<string>;
        clientLabel: string;
        state: string;
        expiresAtUnix: number;
        reveal: boolean;
        runId: string | null;
        confirm: boolean;
        requestedBy: string;
      } | null;
    }>;
  };
};

export type BreakGlassOpenMutationVariables = Exact<{
  reason: string;
  code: string;
}>;

export type BreakGlassOpenMutation = {
  openBreakGlassSession: { id: string; reason: string; openedAt: string; expiresAt: string };
};

export type BreakGlassBrowseQueryVariables = Exact<{
  sessionId: string;
}>;

export type BreakGlassBrowseQuery = {
  breakGlassBrowse: {
    folders: Array<{
      id: string;
      name: string;
      parentId: string | null;
      scope: FolderScope;
      ownerUserId: string | null;
      isMasterPersonal: boolean | null;
      order: number | null;
    }>;
    secrets: Array<{ id: string; name: string; folderId: string; typeId: string }>;
  };
  secretTypes: Array<{ id: string; name: string }>;
};

export type BreakGlassOwnersQueryVariables = Exact<{
  ids: Array<string> | string;
}>;

export type BreakGlassOwnersQuery = { resolveUserLabels: Array<{ id: string; name: string }> };

export type BrowseFolderFieldsFragment = {
  id: string;
  name: string;
  parentId: string | null;
  scope: FolderScope;
  ownerUserId: string | null;
  groupId: string | null;
  role: string | null;
  isMasterPersonal: boolean | null;
  order: number | null;
  subtreeSecretCount: number | null;
  owners: Array<string> | null;
  canManage: boolean;
};

export type BrowseFoldersQueryVariables = Exact<{ [key: string]: never }>;

export type BrowseFoldersQuery = {
  folders: Array<{
    id: string;
    name: string;
    parentId: string | null;
    scope: FolderScope;
    ownerUserId: string | null;
    groupId: string | null;
    role: string | null;
    isMasterPersonal: boolean | null;
    order: number | null;
    subtreeSecretCount: number | null;
    owners: Array<string> | null;
    canManage: boolean;
  }>;
};

export type BrowseFolderAccessQueryVariables = Exact<{
  folderId: string;
  ownerIds: Array<string> | string;
}>;

export type BrowseFolderAccessQuery = {
  myFolderAccess: {
    read: boolean;
    reveal: boolean;
    manage: boolean;
    approve: boolean;
    informed: boolean;
    manageRuleset: boolean;
  };
  resolveUserLabels: Array<{ id: string; name: string }>;
};

export type BrowseSecretsQueryVariables = Exact<{
  folderId: string;
  includeRetired?: boolean | null | undefined;
}>;

export type BrowseSecretsQuery = {
  secretsInFolder: Array<{
    id: string;
    name: string;
    folderId: string;
    typeId: string;
    targetId: string | null;
    lastHeartbeatResult: HeartbeatResult | null;
    retired: boolean;
    retiredAt: string;
    canRead: boolean | null;
  }>;
  secretTypes: Array<{ id: string; name: string }>;
};

export type BrowseCreateFolderMutationVariables = Exact<{
  parentId?: string | null | undefined;
  name: string;
}>;

export type BrowseCreateFolderMutation = {
  createFolder: {
    id: string;
    name: string;
    parentId: string | null;
    scope: FolderScope;
    ownerUserId: string | null;
    groupId: string | null;
    role: string | null;
    isMasterPersonal: boolean | null;
    order: number | null;
    subtreeSecretCount: number | null;
    owners: Array<string> | null;
    canManage: boolean;
  };
};

export type BrowseRenameFolderMutationVariables = Exact<{
  id: string;
  name: string;
}>;

export type BrowseRenameFolderMutation = { renameFolder: { id: string; name: string } };

export type BrowseMoveFolderMutationVariables = Exact<{
  id: string;
  newParentId?: string | null | undefined;
}>;

export type BrowseMoveFolderMutation = {
  moveFolder: { id: string; parentId: string | null; scope: FolderScope };
};

export type BrowseDeleteFolderMutationVariables = Exact<{
  id: string;
  reassignToId?: string | null | undefined;
}>;

export type BrowseDeleteFolderMutation = { deleteFolder: boolean };

export type BrowseReorderFoldersMutationVariables = Exact<{
  parentId?: string | null | undefined;
  orderedIds: Array<string> | string;
}>;

export type BrowseReorderFoldersMutation = { reorderFolders: boolean };

export type BrowseCreateFolderMoveRequestMutationVariables = Exact<{
  folderId: string;
  destParentId: string;
  reason?: string | null | undefined;
  folderName?: string | null | undefined;
  destParentName?: string | null | undefined;
}>;

export type BrowseCreateFolderMoveRequestMutation = {
  createFolderMoveRequest: { id: string; kind: RequestKind; status: ApprovalStatus };
};

export type BrowseCreateSecretMoveRequestMutationVariables = Exact<{
  secretId: string;
  destFolderId: string;
  reason?: string | null | undefined;
  secretName?: string | null | undefined;
  destFolderName?: string | null | undefined;
}>;

export type BrowseCreateSecretMoveRequestMutation = {
  createSecretMoveRequest: { id: string; kind: RequestKind; status: ApprovalStatus };
};

export type BrowseMoveSecretMutationVariables = Exact<{
  id: string;
  folderId: string;
}>;

export type BrowseMoveSecretMutation = { updateSecret: { id: string; folderId: string } };

export type BrowseRestoreSecretMutationVariables = Exact<{
  id: string;
}>;

export type BrowseRestoreSecretMutation = { restoreSecret: { id: string; retired: boolean } };

export type DashboardHomeQueryVariables = Exact<{
  userId: string;
  limit?: number | null | undefined;
}>;

export type DashboardHomeQuery = {
  secretStats: { total: number; expiringSoon: number; expired: number; drift: number };
  topAccessedSecrets: Array<{
    id: string;
    name: string;
    folderId: string;
    viewCount: number | null;
    lastAccessedAt: string | null;
  }>;
  activeLeasesForUser: Array<{ id: string; secretId: string; issuedAt: string; expiresAt: string }>;
  approvalRequests: Array<{
    id: string;
    kind: RequestKind;
    status: ApprovalStatus;
    requestedByUserId: string;
    requestedAt: string;
    folderName: string;
    comments: Array<{ id: string }>;
  }>;
  pendingSecretUses: Array<{
    id: string;
    secretName: string;
    fieldKey: string;
    clientLabel: string;
    argv: Array<string>;
    reveal: boolean;
    expiresAtUnix: number;
  }>;
  folders: Array<{ id: string; name: string; parentId: string | null }>;
};

export type DashboardSecretNameQueryVariables = Exact<{
  id: string;
}>;

export type DashboardSecretNameQuery = { secret: { id: string; name: string } | null };

export type DashboardSecretsByStatusQueryVariables = Exact<{
  status: string;
}>;

export type DashboardSecretsByStatusQuery = {
  secretsByStatus: Array<{
    id: string;
    name: string;
    typeId: string;
    folderId: string;
    targetId: string | null;
    expiresAt: string | null;
    lastHeartbeatResult: HeartbeatResult | null;
    heartbeatOptOut: boolean | null;
  }>;
  folders: Array<{ id: string; name: string; parentId: string | null }>;
  secretTypes: Array<{ id: string; name: string }>;
};

export type EditorsTypeFieldsFragment = {
  id: string;
  name: string;
  origin: TypeOrigin;
  vendor: string | null;
  checkout: boolean | null;
  heartbeat: boolean | null;
  rotation: boolean | null;
  fields: Array<{
    key: string;
    label: string;
    kind: FieldKind;
    options: Array<string> | null;
    defaultValue: string | null;
    required: boolean | null;
    sensitive: boolean | null;
    superSensitive: boolean | null;
    rotates: boolean | null;
    policyId: string | null;
    policyEnforcement: PolicyEnforcement | null;
    pattern: string | null;
    maxLength: number | null;
  }>;
};

export type EditorsPolicyFieldsFragment = {
  id: string;
  name: string;
  minLength: number;
  maxLength: number | null;
  requireUpper: boolean;
  requireLower: boolean;
  requireDigit: boolean;
  requireSymbol: boolean;
  startClass: PwStartClass | null;
  endLiteral: string | null;
  excludeChars: string | null;
  isDefault: boolean;
};

export type EditorsTargetFieldsFragment = {
  id: string;
  name: string;
  hostname: string;
  ownerUserId: string | null;
};

export type EditorsPickersQueryVariables = Exact<{ [key: string]: never }>;

export type EditorsPickersQuery = {
  secretTypes: Array<{
    id: string;
    name: string;
    origin: TypeOrigin;
    vendor: string | null;
    checkout: boolean | null;
    heartbeat: boolean | null;
    rotation: boolean | null;
    fields: Array<{
      key: string;
      label: string;
      kind: FieldKind;
      options: Array<string> | null;
      defaultValue: string | null;
      required: boolean | null;
      sensitive: boolean | null;
      superSensitive: boolean | null;
      rotates: boolean | null;
      policyId: string | null;
      policyEnforcement: PolicyEnforcement | null;
      pattern: string | null;
      maxLength: number | null;
    }>;
  }>;
  passwordPolicies: Array<{
    id: string;
    name: string;
    minLength: number;
    maxLength: number | null;
    requireUpper: boolean;
    requireLower: boolean;
    requireDigit: boolean;
    requireSymbol: boolean;
    startClass: PwStartClass | null;
    endLiteral: string | null;
    excludeChars: string | null;
    isDefault: boolean;
  }>;
  folders: Array<{
    id: string;
    name: string;
    parentId: string | null;
    scope: FolderScope;
    canManage: boolean;
  }>;
  targets: Array<{ id: string; name: string; hostname: string; ownerUserId: string | null }>;
  connections: Array<{ id: string; name: string; protocol: string; port: number | null }>;
};

export type EditorsSecretQueryVariables = Exact<{
  id: string;
}>;

export type EditorsSecretQuery = {
  secret: {
    id: string;
    name: string;
    folderId: string;
    typeId: string;
    targetId: string | null;
    expiresAt: string | null;
  } | null;
};

export type EditorsSecretFieldsQueryVariables = Exact<{
  id: string;
}>;

export type EditorsSecretFieldsQuery = { secretFields: Array<{ key: string; value: string }> };

export type EditorsCreateSecretMutationVariables = Exact<{
  input: CreateSecretInput;
}>;

export type EditorsCreateSecretMutation = { createSecret: { id: string } };

export type EditorsUpdateSecretMutationVariables = Exact<{
  id: string;
  input: UpdateSecretInput;
}>;

export type EditorsUpdateSecretMutation = { updateSecret: { id: string } };

export type EditorsGenerateKeyPairMutationVariables = Exact<{
  format: string;
}>;

export type EditorsGenerateKeyPairMutation = {
  generateKeyPair: { publicKey: string; privateKey: string };
};

export type EditorsImportCertificateMutationVariables = Exact<{
  folderId: string;
  name: string;
  fileBase64: string;
  passphrase?: string | null | undefined;
  alias?: string | null | undefined;
}>;

export type EditorsImportCertificateMutation = {
  importCertificate: { aliases: Array<string>; secret: { id: string } | null };
};

export type EditorsSaveTargetMutationVariables = Exact<{
  input: TargetInput;
}>;

export type EditorsSaveTargetMutation = {
  saveTarget: { id: string; name: string; hostname: string; ownerUserId: string | null };
};

export type RequestsRequestFieldsFragment = {
  id: string;
  kind: RequestKind;
  secretId: string;
  folderId: string;
  folderName: string;
  destParentId: string;
  destParentName: string;
  requestedByUserId: string;
  requestedAt: string;
  reason: string | null;
  status: ApprovalStatus;
  resolvedAt: string | null;
  resolvedByUserId: string | null;
  resolvedByUserName: string | null;
  comments: Array<{
    id: string;
    authorUserId: string;
    authorName: string;
    body: string;
    createdAt: string;
  }>;
};

export type CheckoutsLeaseFieldsFragment = {
  id: string;
  secretId: string;
  userId: string;
  issuedAt: string;
  expiresAt: string;
  returned: boolean | null;
};

export type RequestsListQueryVariables = Exact<{ [key: string]: never }>;

export type RequestsListQuery = {
  approvalRequests: Array<{
    id: string;
    kind: RequestKind;
    secretId: string;
    folderId: string;
    folderName: string;
    destParentId: string;
    destParentName: string;
    requestedByUserId: string;
    requestedAt: string;
    reason: string | null;
    status: ApprovalStatus;
    resolvedAt: string | null;
    resolvedByUserId: string | null;
    resolvedByUserName: string | null;
    comments: Array<{
      id: string;
      authorUserId: string;
      authorName: string;
      body: string;
      createdAt: string;
    }>;
  }>;
};

export type RequestsSecretQueryVariables = Exact<{
  id: string;
  secretId: string;
}>;

export type RequestsSecretQuery = {
  secret: { id: string; name: string; folderId: string; typeId: string } | null;
  mySecretAccess: { read: boolean; approve: boolean };
};

export type RequestsPeopleQueryVariables = Exact<{
  ids: Array<string> | string;
}>;

export type RequestsPeopleQuery = { resolveUserLabels: Array<{ id: string; name: string }> };

export type RequestsResolveMutationVariables = Exact<{
  id: string;
  approve: boolean;
  grantHours?: number | null | undefined;
}>;

export type RequestsResolveMutation = {
  resolveApproval: {
    id: string;
    kind: RequestKind;
    secretId: string;
    folderId: string;
    folderName: string;
    destParentId: string;
    destParentName: string;
    requestedByUserId: string;
    requestedAt: string;
    reason: string | null;
    status: ApprovalStatus;
    resolvedAt: string | null;
    resolvedByUserId: string | null;
    resolvedByUserName: string | null;
    comments: Array<{
      id: string;
      authorUserId: string;
      authorName: string;
      body: string;
      createdAt: string;
    }>;
  };
};

export type RequestsCommentMutationVariables = Exact<{
  requestId: string;
  body: string;
}>;

export type RequestsCommentMutation = {
  addApprovalComment: { id: string; comments: Array<{ id: string }> };
};

export type RequestsCreateMutationVariables = Exact<{
  secretId: string;
  reason?: string | null | undefined;
}>;

export type RequestsCreateMutation = {
  createAccessRequest: {
    id: string;
    kind: RequestKind;
    secretId: string;
    folderId: string;
    folderName: string;
    destParentId: string;
    destParentName: string;
    requestedByUserId: string;
    requestedAt: string;
    reason: string | null;
    status: ApprovalStatus;
    resolvedAt: string | null;
    resolvedByUserId: string | null;
    resolvedByUserName: string | null;
    comments: Array<{
      id: string;
      authorUserId: string;
      authorName: string;
      body: string;
      createdAt: string;
    }>;
  };
};

export type CheckoutsMineQueryVariables = Exact<{
  userId: string;
}>;

export type CheckoutsMineQuery = {
  activeLeasesForUser: Array<{
    id: string;
    secretId: string;
    userId: string;
    issuedAt: string;
    expiresAt: string;
    returned: boolean | null;
  }>;
};

export type CheckoutsActiveLeaseQueryVariables = Exact<{
  secretId: string;
}>;

export type CheckoutsActiveLeaseQuery = {
  activeLease: {
    id: string;
    secretId: string;
    userId: string;
    issuedAt: string;
    expiresAt: string;
    returned: boolean | null;
  } | null;
};

export type CheckoutsCheckoutMutationVariables = Exact<{
  secretId: string;
  hours?: number | null | undefined;
}>;

export type CheckoutsCheckoutMutation = {
  checkoutSecret: {
    id: string;
    secretId: string;
    userId: string;
    issuedAt: string;
    expiresAt: string;
    returned: boolean | null;
  };
};

export type CheckoutsCheckinMutationVariables = Exact<{
  secretId: string;
}>;

export type CheckoutsCheckinMutation = { checkinSecret: boolean };

export type SecretDetailFieldsFragment = {
  id: string;
  name: string;
  canRead: boolean | null;
  folderId: string;
  typeId: string;
  targetId: string | null;
  expiresAt: string | null;
  lastHeartbeatResult: HeartbeatResult | null;
  verifiedAt: string | null;
  viewCount: number | null;
  lastAccessedAt: string | null;
  retired: boolean;
  retiredAt: string;
  lastRotationResult: RotationState | null;
  rotatedAt: string | null;
  rotationIntervalDays: number | null;
  nextRotationAt: string | null;
  rotationOptOut: boolean | null;
  heartbeatOptOut: boolean | null;
  requireTokenApproval: boolean | null;
  alwaysRequireApproval: boolean | null;
};

export type SecretCertMetaFieldsFragment = {
  subject: string;
  issuer: string;
  sans: Array<string>;
  notBefore: string;
  notAfter: string;
  serialNumber: string;
  fingerprintSha256: string;
  keyAlgorithm: string;
  keyBits: number;
  isCA: boolean;
  hasPrivateKey: boolean;
};

export type SecretDetailQueryVariables = Exact<{
  id: string;
}>;

export type SecretDetailQuery = {
  secret: {
    id: string;
    name: string;
    canRead: boolean | null;
    folderId: string;
    typeId: string;
    targetId: string | null;
    expiresAt: string | null;
    lastHeartbeatResult: HeartbeatResult | null;
    verifiedAt: string | null;
    viewCount: number | null;
    lastAccessedAt: string | null;
    retired: boolean;
    retiredAt: string;
    lastRotationResult: RotationState | null;
    rotatedAt: string | null;
    rotationIntervalDays: number | null;
    nextRotationAt: string | null;
    rotationOptOut: boolean | null;
    heartbeatOptOut: boolean | null;
    requireTokenApproval: boolean | null;
    alwaysRequireApproval: boolean | null;
  } | null;
  secretTypes: Array<{
    id: string;
    name: string;
    origin: TypeOrigin;
    vendor: string | null;
    checkout: boolean | null;
    heartbeat: boolean | null;
    rotation: boolean | null;
    fields: Array<{
      key: string;
      label: string;
      kind: FieldKind;
      options: Array<string> | null;
      sensitive: boolean | null;
      superSensitive: boolean | null;
      rotates: boolean | null;
    }>;
  }>;
  folders: Array<{ id: string; name: string; parentId: string | null; scope: FolderScope }>;
  targets: Array<{ id: string; name: string; hostname: string }>;
};

export type SecretAccessQueryVariables = Exact<{
  secretId: string;
}>;

export type SecretAccessQuery = {
  mySecretAccess: {
    read: boolean;
    reveal: boolean;
    manage: boolean;
    approve: boolean;
    informed: boolean;
  };
};

export type SecretFieldsQueryVariables = Exact<{
  id: string;
}>;

export type SecretFieldsQuery = { secretFields: Array<{ key: string; value: string }> };

export type SecretVersionsQueryVariables = Exact<{
  secretId: string;
}>;

export type SecretVersionsQuery = {
  secretVersions: Array<{
    versionNo: number;
    createdBy: string;
    createdByName: string;
    createdAt: string;
    active: boolean;
    fieldKeys: Array<string>;
    changedFieldKeys: Array<string>;
  }>;
};

export type SecretRevealMutationVariables = Exact<{
  id: string;
  fieldKey: string;
}>;

export type SecretRevealMutation = { revealSecretField: string };

export type SecretPrepareRevealMutationVariables = Exact<{
  secretId: string;
  fieldKey: string;
  runId?: string | null | undefined;
}>;

export type SecretPrepareRevealMutation = {
  prepareSecretReveal: {
    id: string;
    state: string;
    confirm: boolean;
    runId: string | null;
    expiresAtUnix: number;
  };
};

export type SecretRedeemRevealMutationVariables = Exact<{
  id: string;
}>;

export type SecretRedeemRevealMutation = { redeemSecretReveal: string };

export type SecretRevealVersionMutationVariables = Exact<{
  secretId: string;
  versionNo: number;
  fieldKey: string;
}>;

export type SecretRevealVersionMutation = { revealSecretVersionField: string };

export type SecretRestoreVersionMutationVariables = Exact<{
  secretId: string;
  versionNo: number;
}>;

export type SecretRestoreVersionMutation = {
  restoreSecretVersion: {
    id: string;
    name: string;
    canRead: boolean | null;
    folderId: string;
    typeId: string;
    targetId: string | null;
    expiresAt: string | null;
    lastHeartbeatResult: HeartbeatResult | null;
    verifiedAt: string | null;
    viewCount: number | null;
    lastAccessedAt: string | null;
    retired: boolean;
    retiredAt: string;
    lastRotationResult: RotationState | null;
    rotatedAt: string | null;
    rotationIntervalDays: number | null;
    nextRotationAt: string | null;
    rotationOptOut: boolean | null;
    heartbeatOptOut: boolean | null;
    requireTokenApproval: boolean | null;
    alwaysRequireApproval: boolean | null;
  };
};

export type SecretBreakGlassMutationVariables = Exact<{
  secretId: string;
  reason: string;
  code: string;
  sessionId?: string | null | undefined;
}>;

export type SecretBreakGlassMutation = { breakGlassSecret: Array<{ key: string; value: string }> };

export type SecretRotateMutationVariables = Exact<{
  secretId: string;
}>;

export type SecretRotateMutation = { rotateSecret: boolean };

export type SecretSetAutomationMutationVariables = Exact<{
  secretId: string;
  disableRotation: boolean;
  disableHeartbeat: boolean;
}>;

export type SecretSetAutomationMutation = {
  setSecretAutomation: {
    id: string;
    name: string;
    canRead: boolean | null;
    folderId: string;
    typeId: string;
    targetId: string | null;
    expiresAt: string | null;
    lastHeartbeatResult: HeartbeatResult | null;
    verifiedAt: string | null;
    viewCount: number | null;
    lastAccessedAt: string | null;
    retired: boolean;
    retiredAt: string;
    lastRotationResult: RotationState | null;
    rotatedAt: string | null;
    rotationIntervalDays: number | null;
    nextRotationAt: string | null;
    rotationOptOut: boolean | null;
    heartbeatOptOut: boolean | null;
    requireTokenApproval: boolean | null;
    alwaysRequireApproval: boolean | null;
  };
};

export type SecretSetTokenApprovalMutationVariables = Exact<{
  secretId: string;
  required: boolean;
  always?: boolean | null | undefined;
}>;

export type SecretSetTokenApprovalMutation = {
  setSecretTokenApproval: {
    id: string;
    name: string;
    canRead: boolean | null;
    folderId: string;
    typeId: string;
    targetId: string | null;
    expiresAt: string | null;
    lastHeartbeatResult: HeartbeatResult | null;
    verifiedAt: string | null;
    viewCount: number | null;
    lastAccessedAt: string | null;
    retired: boolean;
    retiredAt: string;
    lastRotationResult: RotationState | null;
    rotatedAt: string | null;
    rotationIntervalDays: number | null;
    nextRotationAt: string | null;
    rotationOptOut: boolean | null;
    heartbeatOptOut: boolean | null;
    requireTokenApproval: boolean | null;
    alwaysRequireApproval: boolean | null;
  };
};

export type SecretRetireMutationVariables = Exact<{
  id: string;
}>;

export type SecretRetireMutation = {
  retireSecret: {
    id: string;
    name: string;
    canRead: boolean | null;
    folderId: string;
    typeId: string;
    targetId: string | null;
    expiresAt: string | null;
    lastHeartbeatResult: HeartbeatResult | null;
    verifiedAt: string | null;
    viewCount: number | null;
    lastAccessedAt: string | null;
    retired: boolean;
    retiredAt: string;
    lastRotationResult: RotationState | null;
    rotatedAt: string | null;
    rotationIntervalDays: number | null;
    nextRotationAt: string | null;
    rotationOptOut: boolean | null;
    heartbeatOptOut: boolean | null;
    requireTokenApproval: boolean | null;
    alwaysRequireApproval: boolean | null;
  };
};

export type SecretRestoreMutationVariables = Exact<{
  id: string;
}>;

export type SecretRestoreMutation = {
  restoreSecret: {
    id: string;
    name: string;
    canRead: boolean | null;
    folderId: string;
    typeId: string;
    targetId: string | null;
    expiresAt: string | null;
    lastHeartbeatResult: HeartbeatResult | null;
    verifiedAt: string | null;
    viewCount: number | null;
    lastAccessedAt: string | null;
    retired: boolean;
    retiredAt: string;
    lastRotationResult: RotationState | null;
    rotatedAt: string | null;
    rotationIntervalDays: number | null;
    nextRotationAt: string | null;
    rotationOptOut: boolean | null;
    heartbeatOptOut: boolean | null;
    requireTokenApproval: boolean | null;
    alwaysRequireApproval: boolean | null;
  };
};

export type SecretDeleteMutationVariables = Exact<{
  id: string;
}>;

export type SecretDeleteMutation = { deleteSecret: boolean };

export type SecretExportCertificateMutationVariables = Exact<{
  secretId: string;
  format: string;
  newPassphrase?: string | null | undefined;
}>;

export type SecretExportCertificateMutation = {
  exportCertificate: { fileBase64: string; filename: string; contentType: string };
};

export type SecretReplaceCertificateMutationVariables = Exact<{
  secretId: string;
  fileBase64: string;
  passphrase?: string | null | undefined;
  alias?: string | null | undefined;
}>;

export type SecretReplaceCertificateMutation = {
  replaceCertificate: {
    aliases: Array<string>;
    secret: {
      id: string;
      name: string;
      canRead: boolean | null;
      folderId: string;
      typeId: string;
      targetId: string | null;
      expiresAt: string | null;
      lastHeartbeatResult: HeartbeatResult | null;
      verifiedAt: string | null;
      viewCount: number | null;
      lastAccessedAt: string | null;
      retired: boolean;
      retiredAt: string;
      lastRotationResult: RotationState | null;
      rotatedAt: string | null;
      rotationIntervalDays: number | null;
      nextRotationAt: string | null;
      rotationOptOut: boolean | null;
      heartbeatOptOut: boolean | null;
      requireTokenApproval: boolean | null;
      alwaysRequireApproval: boolean | null;
    } | null;
    meta: {
      subject: string;
      issuer: string;
      sans: Array<string>;
      notBefore: string;
      notAfter: string;
      serialNumber: string;
      fingerprintSha256: string;
      keyAlgorithm: string;
      keyBits: number;
      isCA: boolean;
      hasPrivateKey: boolean;
    } | null;
  };
};

export type SharingRuleFieldsFragment = {
  id: string;
  order: number;
  subjectKind: SubjectKind;
  subjectName: string;
  subjectId: string | null;
  grants: Array<{ action: RaciAction; value: RaciGrant }>;
};

export type SharingInheritedRuleFieldsFragment = {
  fromFolderId: string;
  fromFolderName: string;
  rule: {
    id: string;
    order: number;
    subjectKind: SubjectKind;
    subjectName: string;
    subjectId: string | null;
    grants: Array<{ action: RaciAction; value: RaciGrant }>;
  };
};

export type SharingAccessFieldsFragment = {
  read: boolean;
  reveal: boolean;
  manage: boolean;
  approve: boolean;
  informed: boolean;
  manageRuleset: boolean;
};

export type SharingDecisionFieldsFragment = {
  read: boolean;
  readReason: string;
  reveal: boolean;
  revealReason: string;
  manage: boolean;
  manageReason: string;
  approve: boolean;
  approveReason: string;
  informed: boolean;
  informedReason: string;
};

export type SharingFoldersQueryVariables = Exact<{ [key: string]: never }>;

export type SharingFoldersQuery = {
  folders: Array<{
    id: string;
    name: string;
    parentId: string | null;
    owners: Array<string> | null;
    subtreeSecretCount: number | null;
  }>;
};

export type SharingFolderAccessQueryVariables = Exact<{
  folderId: string;
}>;

export type SharingFolderAccessQuery = {
  myFolderAccess: {
    read: boolean;
    reveal: boolean;
    manage: boolean;
    approve: boolean;
    informed: boolean;
    manageRuleset: boolean;
  };
};

export type SharingFolderRulesetQueryVariables = Exact<{
  folderId: string;
}>;

export type SharingFolderRulesetQuery = {
  folderRuleset: {
    folderId: string;
    owners: Array<string>;
    rules: Array<{
      id: string;
      order: number;
      subjectKind: SubjectKind;
      subjectName: string;
      subjectId: string | null;
      grants: Array<{ action: RaciAction; value: RaciGrant }>;
    }>;
    inherited: Array<{
      fromFolderId: string;
      fromFolderName: string;
      rule: {
        id: string;
        order: number;
        subjectKind: SubjectKind;
        subjectName: string;
        subjectId: string | null;
        grants: Array<{ action: RaciAction; value: RaciGrant }>;
      };
    }>;
    inheritedOwners: Array<{ userId: string; fromFolderId: string; fromFolderName: string }>;
  };
  groups: Array<{ id: string; name: string }>;
};

export type SharingSecretQueryVariables = Exact<{
  secretId: string;
}>;

export type SharingSecretQuery = { secret: { id: string; name: string; folderId: string } | null };

export type SharingSecretAccessQueryVariables = Exact<{
  secretId: string;
}>;

export type SharingSecretAccessQuery = {
  mySecretAccess: {
    read: boolean;
    reveal: boolean;
    manage: boolean;
    approve: boolean;
    informed: boolean;
    manageRuleset: boolean;
  };
};

export type SharingSecretRulesetQueryVariables = Exact<{
  secretId: string;
}>;

export type SharingSecretRulesetQuery = {
  secretRuleset: {
    secretId: string;
    rules: Array<{
      id: string;
      order: number;
      subjectKind: SubjectKind;
      subjectName: string;
      subjectId: string | null;
      grants: Array<{ action: RaciAction; value: RaciGrant }>;
    }>;
    inherited: Array<{
      fromFolderId: string;
      fromFolderName: string;
      rule: {
        id: string;
        order: number;
        subjectKind: SubjectKind;
        subjectName: string;
        subjectId: string | null;
        grants: Array<{ action: RaciAction; value: RaciGrant }>;
      };
    }>;
  };
  groups: Array<{ id: string; name: string }>;
};

export type SharingUserLabelsQueryVariables = Exact<{
  ids: Array<string> | string;
}>;

export type SharingUserLabelsQuery = { resolveUserLabels: Array<{ id: string; name: string }> };

export type SharingSearchUsersQueryVariables = Exact<{
  query: string;
  limit?: number | null | undefined;
}>;

export type SharingSearchUsersQuery = {
  searchUsers: Array<{ id: string; name: string; email: string }>;
};

export type SharingSimulateFolderQueryVariables = Exact<{
  folderId: string;
  userId: string;
  draftRules: Array<RaciRuleInput> | RaciRuleInput;
}>;

export type SharingSimulateFolderQuery = {
  simulateFolder: {
    read: boolean;
    readReason: string;
    reveal: boolean;
    revealReason: string;
    manage: boolean;
    manageReason: string;
    approve: boolean;
    approveReason: string;
    informed: boolean;
    informedReason: string;
  };
};

export type SharingSimulateSecretQueryVariables = Exact<{
  secretId: string;
  userId: string;
  draftRules: Array<RaciRuleInput> | RaciRuleInput;
}>;

export type SharingSimulateSecretQuery = {
  simulateSecret: {
    read: boolean;
    readReason: string;
    reveal: boolean;
    revealReason: string;
    manage: boolean;
    manageReason: string;
    approve: boolean;
    approveReason: string;
    informed: boolean;
    informedReason: string;
  };
};

export type SharingSetFolderRulesetMutationVariables = Exact<{
  folderId: string;
  owners: Array<string> | string;
  rules: Array<RaciRuleInput> | RaciRuleInput;
}>;

export type SharingSetFolderRulesetMutation = { setFolderRuleset: { folderId: string } };

export type SharingSetSecretRulesetMutationVariables = Exact<{
  secretId: string;
  rules: Array<RaciRuleInput> | RaciRuleInput;
}>;

export type SharingSetSecretRulesetMutation = { setSecretRuleset: { secretId: string } };

export type TargetsTargetFieldsFragment = {
  id: string;
  name: string;
  hostname: string;
  kind: string | null;
  domain: string | null;
  realm: string | null;
  connectionId: string;
  description: string | null;
  secretCount: number;
  ownerUserId: string | null;
  sshHostKeys: Array<string>;
};

export type TargetsConnectionFieldsFragment = {
  id: string;
  name: string;
  protocol: string;
  port: number | null;
  description: string | null;
};

export type TargetsListQueryVariables = Exact<{ [key: string]: never }>;

export type TargetsListQuery = {
  targets: Array<{
    id: string;
    name: string;
    hostname: string;
    kind: string | null;
    domain: string | null;
    realm: string | null;
    connectionId: string;
    description: string | null;
    secretCount: number;
    ownerUserId: string | null;
    sshHostKeys: Array<string>;
  }>;
  connections: Array<{
    id: string;
    name: string;
    protocol: string;
    port: number | null;
    description: string | null;
  }>;
};

export type TargetsSaveMutationVariables = Exact<{
  input: TargetInput;
}>;

export type TargetsSaveMutation = {
  saveTarget: {
    id: string;
    name: string;
    hostname: string;
    kind: string | null;
    domain: string | null;
    realm: string | null;
    connectionId: string;
    description: string | null;
    secretCount: number;
    ownerUserId: string | null;
    sshHostKeys: Array<string>;
  };
};

export type TargetsDeleteMutationVariables = Exact<{
  id: string;
}>;

export type TargetsDeleteMutation = { deleteTarget: boolean };

export type TargetsTerminalQueryVariables = Exact<{
  id: string;
}>;

export type TargetsTerminalQuery = {
  secret: {
    id: string;
    name: string;
    typeId: string;
    targetId: string | null;
    retired: boolean;
    canRead: boolean | null;
  } | null;
  targets: Array<{
    id: string;
    name: string;
    hostname: string;
    connectionId: string;
    sshHostKeys: Array<string>;
  }>;
  connections: Array<{ id: string; protocol: string; port: number | null }>;
};

export type TargetsTerminalFieldsQueryVariables = Exact<{
  id: string;
}>;

export type TargetsTerminalFieldsQuery = { secretFields: Array<{ key: string; value: string }> };

export type TargetsOpenSshSessionMutationVariables = Exact<{
  secretId: string;
}>;

export type TargetsOpenSshSessionMutation = {
  openSshSession: { wsUrl: string; ticket: string; sessionId: string; expiresInSeconds: number };
};

export class TypedDocumentString<TResult, TVariables>
  extends String
  implements DocumentTypeDecoration<TResult, TVariables>
{
  __apiType?: NonNullable<DocumentTypeDecoration<TResult, TVariables>["__apiType"]>;
  private value: string;
  public __meta__?: Record<string, any> | undefined;

  constructor(value: string, __meta__?: Record<string, any> | undefined) {
    super(value);
    this.value = value;
    this.__meta__ = __meta__;
  }

  override toString(): string & DocumentTypeDecoration<TResult, TVariables> {
    return this.value;
  }
}
export const AuditRecordFieldsFragmentDoc = new TypedDocumentString(
  `
    fragment AuditRecordFields on AuditRecord {
  seq
  tier
  action
  actorUserId
  actorName
  subject
  subjectKind
  subjectId
  subjectName
  groupId
  sensitive
  attributes {
    key
    value
  }
  occurredAt
  prevHash
  hash
}
    `,
  { fragmentName: "AuditRecordFields" },
) as unknown as TypedDocumentString<AuditRecordFieldsFragment, unknown>;
export const ServiceAccountFieldsFragmentDoc = new TypedDocumentString(
  `
    fragment ServiceAccountFields on ServiceAccount {
  id
  name
  description
  disabled
  createdBy
  createdAtUnix
  oidcIssuer
  oidcSubject
  oidcAllowedGroups
}
    `,
  { fragmentName: "ServiceAccountFields" },
) as unknown as TypedDocumentString<ServiceAccountFieldsFragment, unknown>;
export const ApiTokenFieldsFragmentDoc = new TypedDocumentString(
  `
    fragment ApiTokenFields on ApiToken {
  id
  serviceAccountId
  scope
  expiresAtUnix
  revokedAtUnix
  lastUsedAtUnix
  createdBy
}
    `,
  { fragmentName: "ApiTokenFields" },
) as unknown as TypedDocumentString<ApiTokenFieldsFragment, unknown>;
export const SecretTypeFieldsFragmentDoc = new TypedDocumentString(
  `
    fragment SecretTypeFields on SecretType {
  id
  name
  heartbeat
  checkout
  rotation
  origin
  vendor
  fields {
    key
    label
    kind
    options
    defaultValue
    required
    sensitive
    policyId
    policyEnforcement
    rotates
    superSensitive
    pattern
    maxLength
  }
}
    `,
  { fragmentName: "SecretTypeFields" },
) as unknown as TypedDocumentString<SecretTypeFieldsFragment, unknown>;
export const PasswordPolicyFieldsFragmentDoc = new TypedDocumentString(
  `
    fragment PasswordPolicyFields on PasswordPolicy {
  id
  name
  minLength
  maxLength
  requireUpper
  requireLower
  requireDigit
  requireSymbol
  rotationDays
  startClass
  endLiteral
  excludeChars
  isDefault
  byTypeFields
  deletable
}
    `,
  { fragmentName: "PasswordPolicyFields" },
) as unknown as TypedDocumentString<PasswordPolicyFieldsFragment, unknown>;
export const SecuritySettingsFieldsFragmentDoc = new TypedDocumentString(
  `
    fragment SecuritySettingsFields on SecuritySettings {
  defaultPasswordPolicyId
  requireMfaForSensitiveCheckout
  allowApiForSensitive
  requestHistoryRetentionDays
  sessionTtlSeconds
  requireMfaForReveal
}
    `,
  { fragmentName: "SecuritySettingsFields" },
) as unknown as TypedDocumentString<SecuritySettingsFieldsFragment, unknown>;
export const AdminRaciRuleFieldsFragmentDoc = new TypedDocumentString(
  `
    fragment AdminRaciRuleFields on RaciRule {
  id
  subjectKind
  subjectName
  subjectId
  grants {
    action
    value
  }
}
    `,
  { fragmentName: "AdminRaciRuleFields" },
) as unknown as TypedDocumentString<AdminRaciRuleFieldsFragment, unknown>;
export const ConnectionFieldsFragmentDoc = new TypedDocumentString(
  `
    fragment ConnectionFields on Connection {
  id
  name
  protocol
  port
  useTls
  description
  targetCount
}
    `,
  { fragmentName: "ConnectionFields" },
) as unknown as TypedDocumentString<ConnectionFieldsFragment, unknown>;
export const TargetFieldsFragmentDoc = new TypedDocumentString(
  `
    fragment TargetFields on Target {
  id
  name
  hostname
  kind
  domain
  realm
  connectionId
  description
  secretCount
  ownerUserId
  sshHostKeys
}
    `,
  { fragmentName: "TargetFields" },
) as unknown as TypedDocumentString<TargetFieldsFragment, unknown>;
export const UserFieldsFragmentDoc = new TypedDocumentString(
  `
    fragment UserFields on User {
  id
  name
  username
  email
  roles
  isRoot
  emailVerified
  disabled
}
    `,
  { fragmentName: "UserFields" },
) as unknown as TypedDocumentString<UserFieldsFragment, unknown>;
export const ComponentVersionFieldsFragmentDoc = new TypedDocumentString(
  `
    fragment ComponentVersionFields on ComponentVersion {
  name
  version
  commit
  status
  dependencies {
    name
    state
    required
    error
    version
  }
}
    `,
  { fragmentName: "ComponentVersionFields" },
) as unknown as TypedDocumentString<ComponentVersionFieldsFragment, unknown>;
export const AgentsTokenFieldsFragmentDoc = new TypedDocumentString(
  `
    fragment AgentsTokenFields on UserToken {
  id
  label
  clientName
  createdAtUnix
  lastUsedAtUnix
  expiresAtUnix
  revokedAtUnix
}
    `,
  { fragmentName: "AgentsTokenFields" },
) as unknown as TypedDocumentString<AgentsTokenFieldsFragment, unknown>;
export const AgentsGrantFieldsFragmentDoc = new TypedDocumentString(
  `
    fragment AgentsGrantFields on UseGrant {
  id
  tokenId
  secretIds
  folderId
  fieldKeys
  programs {
    program
    argPattern
  }
  expiresAtUnix
  maxUses
  uses
  revokedAtUnix
  allowReveal
}
    `,
  { fragmentName: "AgentsGrantFields" },
) as unknown as TypedDocumentString<AgentsGrantFieldsFragment, unknown>;
export const AgentsUseFieldsFragmentDoc = new TypedDocumentString(
  `
    fragment AgentsUseFields on SecretUse {
  id
  secretName
  fieldKey
  argv
  clientLabel
  state
  expiresAtUnix
  reveal
  runId
  confirm
  requestedBy
}
    `,
  { fragmentName: "AgentsUseFields" },
) as unknown as TypedDocumentString<AgentsUseFieldsFragment, unknown>;
export const AgentsRunUseFieldsFragmentDoc = new TypedDocumentString(
  `
    fragment AgentsRunUseFields on SecretUse {
  ...AgentsUseFields
  purpose
  requester
}
    fragment AgentsUseFields on SecretUse {
  id
  secretName
  fieldKey
  argv
  clientLabel
  state
  expiresAtUnix
  reveal
  runId
  confirm
  requestedBy
}`,
  { fragmentName: "AgentsRunUseFields" },
) as unknown as TypedDocumentString<AgentsRunUseFieldsFragment, unknown>;
export const BrowseFolderFieldsFragmentDoc = new TypedDocumentString(
  `
    fragment BrowseFolderFields on Folder {
  id
  name
  parentId
  scope
  ownerUserId
  groupId
  role
  isMasterPersonal
  order
  subtreeSecretCount
  owners
  canManage
}
    `,
  { fragmentName: "BrowseFolderFields" },
) as unknown as TypedDocumentString<BrowseFolderFieldsFragment, unknown>;
export const EditorsTypeFieldsFragmentDoc = new TypedDocumentString(
  `
    fragment EditorsTypeFields on SecretType {
  id
  name
  origin
  vendor
  checkout
  heartbeat
  rotation
  fields {
    key
    label
    kind
    options
    defaultValue
    required
    sensitive
    superSensitive
    rotates
    policyId
    policyEnforcement
    pattern
    maxLength
  }
}
    `,
  { fragmentName: "EditorsTypeFields" },
) as unknown as TypedDocumentString<EditorsTypeFieldsFragment, unknown>;
export const EditorsPolicyFieldsFragmentDoc = new TypedDocumentString(
  `
    fragment EditorsPolicyFields on PasswordPolicy {
  id
  name
  minLength
  maxLength
  requireUpper
  requireLower
  requireDigit
  requireSymbol
  startClass
  endLiteral
  excludeChars
  isDefault
}
    `,
  { fragmentName: "EditorsPolicyFields" },
) as unknown as TypedDocumentString<EditorsPolicyFieldsFragment, unknown>;
export const EditorsTargetFieldsFragmentDoc = new TypedDocumentString(
  `
    fragment EditorsTargetFields on Target {
  id
  name
  hostname
  ownerUserId
}
    `,
  { fragmentName: "EditorsTargetFields" },
) as unknown as TypedDocumentString<EditorsTargetFieldsFragment, unknown>;
export const RequestsRequestFieldsFragmentDoc = new TypedDocumentString(
  `
    fragment RequestsRequestFields on ApprovalRequest {
  id
  kind
  secretId
  folderId
  folderName
  destParentId
  destParentName
  requestedByUserId
  requestedAt
  reason
  status
  resolvedAt
  resolvedByUserId
  resolvedByUserName
  comments {
    id
    authorUserId
    authorName
    body
    createdAt
  }
}
    `,
  { fragmentName: "RequestsRequestFields" },
) as unknown as TypedDocumentString<RequestsRequestFieldsFragment, unknown>;
export const CheckoutsLeaseFieldsFragmentDoc = new TypedDocumentString(
  `
    fragment CheckoutsLeaseFields on Lease {
  id
  secretId
  userId
  issuedAt
  expiresAt
  returned
}
    `,
  { fragmentName: "CheckoutsLeaseFields" },
) as unknown as TypedDocumentString<CheckoutsLeaseFieldsFragment, unknown>;
export const SecretDetailFieldsFragmentDoc = new TypedDocumentString(
  `
    fragment SecretDetailFields on Secret {
  id
  name
  canRead
  folderId
  typeId
  targetId
  expiresAt
  lastHeartbeatResult
  verifiedAt
  viewCount
  lastAccessedAt
  retired
  retiredAt
  lastRotationResult
  rotatedAt
  rotationIntervalDays
  nextRotationAt
  rotationOptOut
  heartbeatOptOut
  requireTokenApproval
  alwaysRequireApproval
}
    `,
  { fragmentName: "SecretDetailFields" },
) as unknown as TypedDocumentString<SecretDetailFieldsFragment, unknown>;
export const SecretCertMetaFieldsFragmentDoc = new TypedDocumentString(
  `
    fragment SecretCertMetaFields on CertMeta {
  subject
  issuer
  sans
  notBefore
  notAfter
  serialNumber
  fingerprintSha256
  keyAlgorithm
  keyBits
  isCA
  hasPrivateKey
}
    `,
  { fragmentName: "SecretCertMetaFields" },
) as unknown as TypedDocumentString<SecretCertMetaFieldsFragment, unknown>;
export const SharingRuleFieldsFragmentDoc = new TypedDocumentString(
  `
    fragment SharingRuleFields on RaciRule {
  id
  order
  subjectKind
  subjectName
  subjectId
  grants {
    action
    value
  }
}
    `,
  { fragmentName: "SharingRuleFields" },
) as unknown as TypedDocumentString<SharingRuleFieldsFragment, unknown>;
export const SharingInheritedRuleFieldsFragmentDoc = new TypedDocumentString(
  `
    fragment SharingInheritedRuleFields on InheritedRaciRule {
  fromFolderId
  fromFolderName
  rule {
    ...SharingRuleFields
  }
}
    fragment SharingRuleFields on RaciRule {
  id
  order
  subjectKind
  subjectName
  subjectId
  grants {
    action
    value
  }
}`,
  { fragmentName: "SharingInheritedRuleFields" },
) as unknown as TypedDocumentString<SharingInheritedRuleFieldsFragment, unknown>;
export const SharingAccessFieldsFragmentDoc = new TypedDocumentString(
  `
    fragment SharingAccessFields on FolderAccess {
  read
  reveal
  manage
  approve
  informed
  manageRuleset
}
    `,
  { fragmentName: "SharingAccessFields" },
) as unknown as TypedDocumentString<SharingAccessFieldsFragment, unknown>;
export const SharingDecisionFieldsFragmentDoc = new TypedDocumentString(
  `
    fragment SharingDecisionFields on RaciDecision {
  read
  readReason
  reveal
  revealReason
  manage
  manageReason
  approve
  approveReason
  informed
  informedReason
}
    `,
  { fragmentName: "SharingDecisionFields" },
) as unknown as TypedDocumentString<SharingDecisionFieldsFragment, unknown>;
export const TargetsTargetFieldsFragmentDoc = new TypedDocumentString(
  `
    fragment TargetsTargetFields on Target {
  id
  name
  hostname
  kind
  domain
  realm
  connectionId
  description
  secretCount
  ownerUserId
  sshHostKeys
}
    `,
  { fragmentName: "TargetsTargetFields" },
) as unknown as TypedDocumentString<TargetsTargetFieldsFragment, unknown>;
export const TargetsConnectionFieldsFragmentDoc = new TypedDocumentString(
  `
    fragment TargetsConnectionFields on Connection {
  id
  name
  protocol
  port
  description
}
    `,
  { fragmentName: "TargetsConnectionFields" },
) as unknown as TypedDocumentString<TargetsConnectionFieldsFragment, unknown>;
export const AdminAuditDocument = new TypedDocumentString(`
    query AdminAudit($actorUserId: String, $subject: String, $excludeActions: [String!], $limit: Int) {
  auditRecords(
    actorUserId: $actorUserId
    subject: $subject
    excludeActions: $excludeActions
    limit: $limit
  ) {
    ...AuditRecordFields
  }
  auditActions
  auditChain {
    valid
    brokenAtSeq
    length
  }
  users {
    id
    name
    username
  }
  groups {
    id
    name
  }
}
    fragment AuditRecordFields on AuditRecord {
  seq
  tier
  action
  actorUserId
  actorName
  subject
  subjectKind
  subjectId
  subjectName
  groupId
  sensitive
  attributes {
    key
    value
  }
  occurredAt
  prevHash
  hash
}`) as unknown as TypedDocumentString<AdminAuditQuery, AdminAuditQueryVariables>;
export const AdminBreakGlassSessionsDocument = new TypedDocumentString(`
    query AdminBreakGlassSessions($limit: Int) {
  breakGlassSessions(limit: $limit) {
    id
    actorUserId
    actorName
    reason
    openedAt
    expiresAt
    endedAt
    endReason
    reveals {
      eventId
      secretId
      secretName
      revealedAt
      postRotationScheduled
      ownerNotified
    }
  }
}
    `) as unknown as TypedDocumentString<
  AdminBreakGlassSessionsQuery,
  AdminBreakGlassSessionsQueryVariables
>;
export const AdminFolderSettingsDocument = new TypedDocumentString(`
    query AdminFolderSettings {
  folders {
    id
    revealStepUp
  }
  securitySettings {
    requireMfaForReveal
  }
  users {
    id
    name
  }
}
    `) as unknown as TypedDocumentString<
  AdminFolderSettingsQuery,
  AdminFolderSettingsQueryVariables
>;
export const AdminSetFolderRevealStepUpDocument = new TypedDocumentString(`
    mutation AdminSetFolderRevealStepUp($folderId: String!, $mode: StepUpMode!) {
  setFolderRevealStepUp(folderId: $folderId, mode: $mode) {
    id
    revealStepUp
  }
}
    `) as unknown as TypedDocumentString<
  AdminSetFolderRevealStepUpMutation,
  AdminSetFolderRevealStepUpMutationVariables
>;
export const AdminServiceAccountsDocument = new TypedDocumentString(`
    query AdminServiceAccounts {
  serviceAccounts {
    ...ServiceAccountFields
  }
  users {
    id
    name
  }
}
    fragment ServiceAccountFields on ServiceAccount {
  id
  name
  description
  disabled
  createdBy
  createdAtUnix
  oidcIssuer
  oidcSubject
  oidcAllowedGroups
}`) as unknown as TypedDocumentString<
  AdminServiceAccountsQuery,
  AdminServiceAccountsQueryVariables
>;
export const AdminServiceAccountDocument = new TypedDocumentString(`
    query AdminServiceAccount($id: ID!) {
  serviceAccounts {
    ...ServiceAccountFields
  }
  apiTokens(serviceAccountId: $id) {
    ...ApiTokenFields
  }
  groups {
    id
    name
  }
  users {
    id
    name
  }
}
    fragment ServiceAccountFields on ServiceAccount {
  id
  name
  description
  disabled
  createdBy
  createdAtUnix
  oidcIssuer
  oidcSubject
  oidcAllowedGroups
}
fragment ApiTokenFields on ApiToken {
  id
  serviceAccountId
  scope
  expiresAtUnix
  revokedAtUnix
  lastUsedAtUnix
  createdBy
}`) as unknown as TypedDocumentString<AdminServiceAccountQuery, AdminServiceAccountQueryVariables>;
export const AdminCreateServiceAccountDocument = new TypedDocumentString(`
    mutation AdminCreateServiceAccount($name: String!, $description: String!) {
  createServiceAccount(name: $name, description: $description) {
    id
  }
}
    `) as unknown as TypedDocumentString<
  AdminCreateServiceAccountMutation,
  AdminCreateServiceAccountMutationVariables
>;
export const AdminDisableServiceAccountDocument = new TypedDocumentString(`
    mutation AdminDisableServiceAccount($id: ID!) {
  disableServiceAccount(id: $id) {
    id
    disabled
  }
}
    `) as unknown as TypedDocumentString<
  AdminDisableServiceAccountMutation,
  AdminDisableServiceAccountMutationVariables
>;
export const AdminMintApiTokenDocument = new TypedDocumentString(`
    mutation AdminMintApiToken($serviceAccountId: ID!, $scope: String!, $expiresAt: Int) {
  mintApiToken(
    serviceAccountId: $serviceAccountId
    scope: $scope
    expiresAt: $expiresAt
  ) {
    token
    apiToken {
      ...ApiTokenFields
    }
  }
}
    fragment ApiTokenFields on ApiToken {
  id
  serviceAccountId
  scope
  expiresAtUnix
  revokedAtUnix
  lastUsedAtUnix
  createdBy
}`) as unknown as TypedDocumentString<
  AdminMintApiTokenMutation,
  AdminMintApiTokenMutationVariables
>;
export const AdminRevokeApiTokenDocument = new TypedDocumentString(`
    mutation AdminRevokeApiToken($id: ID!) {
  revokeApiToken(id: $id) {
    id
    revokedAtUnix
  }
}
    `) as unknown as TypedDocumentString<
  AdminRevokeApiTokenMutation,
  AdminRevokeApiTokenMutationVariables
>;
export const AdminLinkOidcClientDocument = new TypedDocumentString(`
    mutation AdminLinkOidcClient($serviceAccountId: ID!, $oidcSubject: String!, $allowedGroups: [String!]!) {
  linkOidcClient(
    serviceAccountId: $serviceAccountId
    oidcSubject: $oidcSubject
    allowedGroups: $allowedGroups
  ) {
    ...ServiceAccountFields
  }
}
    fragment ServiceAccountFields on ServiceAccount {
  id
  name
  description
  disabled
  createdBy
  createdAtUnix
  oidcIssuer
  oidcSubject
  oidcAllowedGroups
}`) as unknown as TypedDocumentString<
  AdminLinkOidcClientMutation,
  AdminLinkOidcClientMutationVariables
>;
export const AdminUnlinkOidcClientDocument = new TypedDocumentString(`
    mutation AdminUnlinkOidcClient($serviceAccountId: ID!) {
  unlinkOidcClient(serviceAccountId: $serviceAccountId) {
    ...ServiceAccountFields
  }
}
    fragment ServiceAccountFields on ServiceAccount {
  id
  name
  description
  disabled
  createdBy
  createdAtUnix
  oidcIssuer
  oidcSubject
  oidcAllowedGroups
}`) as unknown as TypedDocumentString<
  AdminUnlinkOidcClientMutation,
  AdminUnlinkOidcClientMutationVariables
>;
export const AdminSecretTypesDocument = new TypedDocumentString(`
    query AdminSecretTypes {
  secretTypes {
    ...SecretTypeFields
  }
  availableExtensions {
    id
    name
    vendor
    fields {
      label
    }
  }
}
    fragment SecretTypeFields on SecretType {
  id
  name
  heartbeat
  checkout
  rotation
  origin
  vendor
  fields {
    key
    label
    kind
    options
    defaultValue
    required
    sensitive
    policyId
    policyEnforcement
    rotates
    superSensitive
    pattern
    maxLength
  }
}`) as unknown as TypedDocumentString<AdminSecretTypesQuery, AdminSecretTypesQueryVariables>;
export const AdminSecretTypeDocument = new TypedDocumentString(`
    query AdminSecretType {
  secretTypes {
    ...SecretTypeFields
  }
  passwordPolicies {
    id
    name
    minLength
    maxLength
    isDefault
  }
}
    fragment SecretTypeFields on SecretType {
  id
  name
  heartbeat
  checkout
  rotation
  origin
  vendor
  fields {
    key
    label
    kind
    options
    defaultValue
    required
    sensitive
    policyId
    policyEnforcement
    rotates
    superSensitive
    pattern
    maxLength
  }
}`) as unknown as TypedDocumentString<AdminSecretTypeQuery, AdminSecretTypeQueryVariables>;
export const AdminCreateSecretTypeDocument = new TypedDocumentString(`
    mutation AdminCreateSecretType($input: SecretTypeInput!) {
  createSecretType(input: $input) {
    ...SecretTypeFields
  }
}
    fragment SecretTypeFields on SecretType {
  id
  name
  heartbeat
  checkout
  rotation
  origin
  vendor
  fields {
    key
    label
    kind
    options
    defaultValue
    required
    sensitive
    policyId
    policyEnforcement
    rotates
    superSensitive
    pattern
    maxLength
  }
}`) as unknown as TypedDocumentString<
  AdminCreateSecretTypeMutation,
  AdminCreateSecretTypeMutationVariables
>;
export const AdminUpdateSecretTypeDocument = new TypedDocumentString(`
    mutation AdminUpdateSecretType($id: ID!, $input: SecretTypeInput!) {
  updateSecretType(id: $id, input: $input) {
    ...SecretTypeFields
  }
}
    fragment SecretTypeFields on SecretType {
  id
  name
  heartbeat
  checkout
  rotation
  origin
  vendor
  fields {
    key
    label
    kind
    options
    defaultValue
    required
    sensitive
    policyId
    policyEnforcement
    rotates
    superSensitive
    pattern
    maxLength
  }
}`) as unknown as TypedDocumentString<
  AdminUpdateSecretTypeMutation,
  AdminUpdateSecretTypeMutationVariables
>;
export const AdminDeleteSecretTypeDocument = new TypedDocumentString(`
    mutation AdminDeleteSecretType($id: ID!) {
  deleteSecretType(id: $id)
}
    `) as unknown as TypedDocumentString<
  AdminDeleteSecretTypeMutation,
  AdminDeleteSecretTypeMutationVariables
>;
export const AdminCloneSecretTypeDocument = new TypedDocumentString(`
    mutation AdminCloneSecretType($id: ID!) {
  cloneSecretType(id: $id) {
    id
    name
  }
}
    `) as unknown as TypedDocumentString<
  AdminCloneSecretTypeMutation,
  AdminCloneSecretTypeMutationVariables
>;
export const AdminImportExtensionDocument = new TypedDocumentString(`
    mutation AdminImportExtension($id: ID!) {
  importExtension(id: $id) {
    id
    name
  }
}
    `) as unknown as TypedDocumentString<
  AdminImportExtensionMutation,
  AdminImportExtensionMutationVariables
>;
export const AdminImportExtensionFromJsonDocument = new TypedDocumentString(`
    mutation AdminImportExtensionFromJson($json: String!) {
  importExtensionFromJson(json: $json) {
    id
    name
  }
}
    `) as unknown as TypedDocumentString<
  AdminImportExtensionFromJsonMutation,
  AdminImportExtensionFromJsonMutationVariables
>;
export const AdminPoliciesDocument = new TypedDocumentString(`
    query AdminPolicies {
  passwordPolicies {
    ...PasswordPolicyFields
  }
  securitySettings {
    ...SecuritySettingsFields
  }
}
    fragment PasswordPolicyFields on PasswordPolicy {
  id
  name
  minLength
  maxLength
  requireUpper
  requireLower
  requireDigit
  requireSymbol
  rotationDays
  startClass
  endLiteral
  excludeChars
  isDefault
  byTypeFields
  deletable
}
fragment SecuritySettingsFields on SecuritySettings {
  defaultPasswordPolicyId
  requireMfaForSensitiveCheckout
  allowApiForSensitive
  requestHistoryRetentionDays
  sessionTtlSeconds
  requireMfaForReveal
}`) as unknown as TypedDocumentString<AdminPoliciesQuery, AdminPoliciesQueryVariables>;
export const AdminSavePasswordPolicyDocument = new TypedDocumentString(`
    mutation AdminSavePasswordPolicy($input: PasswordPolicyInput!) {
  savePasswordPolicy(input: $input) {
    ...PasswordPolicyFields
  }
}
    fragment PasswordPolicyFields on PasswordPolicy {
  id
  name
  minLength
  maxLength
  requireUpper
  requireLower
  requireDigit
  requireSymbol
  rotationDays
  startClass
  endLiteral
  excludeChars
  isDefault
  byTypeFields
  deletable
}`) as unknown as TypedDocumentString<
  AdminSavePasswordPolicyMutation,
  AdminSavePasswordPolicyMutationVariables
>;
export const AdminDeletePasswordPolicyDocument = new TypedDocumentString(`
    mutation AdminDeletePasswordPolicy($id: ID!) {
  deletePasswordPolicy(id: $id)
}
    `) as unknown as TypedDocumentString<
  AdminDeletePasswordPolicyMutation,
  AdminDeletePasswordPolicyMutationVariables
>;
export const AdminUpdateSecuritySettingsDocument = new TypedDocumentString(`
    mutation AdminUpdateSecuritySettings($input: SecuritySettingsInput!) {
  updateSecuritySettings(input: $input) {
    ...SecuritySettingsFields
  }
}
    fragment SecuritySettingsFields on SecuritySettings {
  defaultPasswordPolicyId
  requireMfaForSensitiveCheckout
  allowApiForSensitive
  requestHistoryRetentionDays
  sessionTtlSeconds
  requireMfaForReveal
}`) as unknown as TypedDocumentString<
  AdminUpdateSecuritySettingsMutation,
  AdminUpdateSecuritySettingsMutationVariables
>;
export const AdminFolderRulesetDocument = new TypedDocumentString(`
    query AdminFolderRuleset($folderId: String!) {
  folderRuleset(folderId: $folderId) {
    folderId
    owners
    rules {
      ...AdminRaciRuleFields
    }
    inherited {
      fromFolderId
      fromFolderName
      rule {
        ...AdminRaciRuleFields
      }
    }
    inheritedOwners {
      userId
      fromFolderId
      fromFolderName
    }
  }
  groups {
    id
    name
  }
  users {
    id
    name
  }
}
    fragment AdminRaciRuleFields on RaciRule {
  id
  subjectKind
  subjectName
  subjectId
  grants {
    action
    value
  }
}`) as unknown as TypedDocumentString<AdminFolderRulesetQuery, AdminFolderRulesetQueryVariables>;
export const AdminSetFolderRulesetDocument = new TypedDocumentString(`
    mutation AdminSetFolderRuleset($folderId: String!, $owners: [String!]!, $rules: [RaciRuleInput!]!) {
  setFolderRuleset(folderId: $folderId, owners: $owners, rules: $rules) {
    folderId
  }
}
    `) as unknown as TypedDocumentString<
  AdminSetFolderRulesetMutation,
  AdminSetFolderRulesetMutationVariables
>;
export const AdminConnectionsDocument = new TypedDocumentString(`
    query AdminConnections {
  connections {
    ...ConnectionFields
  }
  targets {
    id
    name
    connectionId
  }
}
    fragment ConnectionFields on Connection {
  id
  name
  protocol
  port
  useTls
  description
  targetCount
}`) as unknown as TypedDocumentString<AdminConnectionsQuery, AdminConnectionsQueryVariables>;
export const AdminSaveConnectionDocument = new TypedDocumentString(`
    mutation AdminSaveConnection($input: ConnectionInput!) {
  saveConnection(input: $input) {
    ...ConnectionFields
  }
}
    fragment ConnectionFields on Connection {
  id
  name
  protocol
  port
  useTls
  description
  targetCount
}`) as unknown as TypedDocumentString<
  AdminSaveConnectionMutation,
  AdminSaveConnectionMutationVariables
>;
export const AdminDeleteConnectionDocument = new TypedDocumentString(`
    mutation AdminDeleteConnection($id: ID!) {
  deleteConnection(id: $id)
}
    `) as unknown as TypedDocumentString<
  AdminDeleteConnectionMutation,
  AdminDeleteConnectionMutationVariables
>;
export const AdminTargetsDocument = new TypedDocumentString(`
    query AdminTargets {
  targets {
    ...TargetFields
  }
  connections {
    id
    name
    protocol
    port
  }
}
    fragment TargetFields on Target {
  id
  name
  hostname
  kind
  domain
  realm
  connectionId
  description
  secretCount
  ownerUserId
  sshHostKeys
}`) as unknown as TypedDocumentString<AdminTargetsQuery, AdminTargetsQueryVariables>;
export const AdminSaveTargetDocument = new TypedDocumentString(`
    mutation AdminSaveTarget($input: TargetInput!) {
  saveTarget(input: $input) {
    ...TargetFields
  }
}
    fragment TargetFields on Target {
  id
  name
  hostname
  kind
  domain
  realm
  connectionId
  description
  secretCount
  ownerUserId
  sshHostKeys
}`) as unknown as TypedDocumentString<AdminSaveTargetMutation, AdminSaveTargetMutationVariables>;
export const AdminDeleteTargetDocument = new TypedDocumentString(`
    mutation AdminDeleteTarget($id: ID!) {
  deleteTarget(id: $id)
}
    `) as unknown as TypedDocumentString<
  AdminDeleteTargetMutation,
  AdminDeleteTargetMutationVariables
>;
export const AdminUsersDocument = new TypedDocumentString(`
    query AdminUsers {
  users {
    ...UserFields
  }
}
    fragment UserFields on User {
  id
  name
  username
  email
  roles
  isRoot
  emailVerified
  disabled
}`) as unknown as TypedDocumentString<AdminUsersQuery, AdminUsersQueryVariables>;
export const AdminUserDocument = new TypedDocumentString(`
    query AdminUser($id: String!) {
  user(id: $id) {
    ...UserFields
    subject
  }
  userGroups(userId: $id) {
    id
    name
  }
  groups {
    id
    name
  }
  userTokens(userId: $id) {
    id
    label
    clientName
    createdAtUnix
    lastUsedAtUnix
    expiresAtUnix
    revokedAtUnix
  }
}
    fragment UserFields on User {
  id
  name
  username
  email
  roles
  isRoot
  emailVerified
  disabled
}`) as unknown as TypedDocumentString<AdminUserQuery, AdminUserQueryVariables>;
export const AdminCreateLocalUserDocument = new TypedDocumentString(`
    mutation AdminCreateLocalUser($username: String!, $email: String!, $name: String!, $password: String!) {
  createLocalUser(
    username: $username
    email: $email
    name: $name
    password: $password
  ) {
    id
  }
}
    `) as unknown as TypedDocumentString<
  AdminCreateLocalUserMutation,
  AdminCreateLocalUserMutationVariables
>;
export const AdminUpdateUserDocument = new TypedDocumentString(`
    mutation AdminUpdateUser($userId: String!, $name: String!, $email: String!, $username: String!) {
  updateUser(userId: $userId, name: $name, email: $email, username: $username) {
    ...UserFields
  }
}
    fragment UserFields on User {
  id
  name
  username
  email
  roles
  isRoot
  emailVerified
  disabled
}`) as unknown as TypedDocumentString<AdminUpdateUserMutation, AdminUpdateUserMutationVariables>;
export const AdminSetUserRolesDocument = new TypedDocumentString(`
    mutation AdminSetUserRoles($userId: String!, $roles: [String!]!) {
  setUserRoles(userId: $userId, roles: $roles) {
    ...UserFields
  }
}
    fragment UserFields on User {
  id
  name
  username
  email
  roles
  isRoot
  emailVerified
  disabled
}`) as unknown as TypedDocumentString<
  AdminSetUserRolesMutation,
  AdminSetUserRolesMutationVariables
>;
export const AdminSetUserDisabledDocument = new TypedDocumentString(`
    mutation AdminSetUserDisabled($userId: String!, $disabled: Boolean!) {
  setUserDisabled(userId: $userId, disabled: $disabled) {
    ...UserFields
  }
}
    fragment UserFields on User {
  id
  name
  username
  email
  roles
  isRoot
  emailVerified
  disabled
}`) as unknown as TypedDocumentString<
  AdminSetUserDisabledMutation,
  AdminSetUserDisabledMutationVariables
>;
export const AdminRequestEmailVerificationDocument = new TypedDocumentString(`
    mutation AdminRequestEmailVerification($userId: String!) {
  requestEmailVerification(userId: $userId)
}
    `) as unknown as TypedDocumentString<
  AdminRequestEmailVerificationMutation,
  AdminRequestEmailVerificationMutationVariables
>;
export const AdminConfirmEmailVerificationDocument = new TypedDocumentString(`
    mutation AdminConfirmEmailVerification($userId: String!, $code: String!) {
  confirmEmailVerification(userId: $userId, code: $code)
}
    `) as unknown as TypedDocumentString<
  AdminConfirmEmailVerificationMutation,
  AdminConfirmEmailVerificationMutationVariables
>;
export const AdminRevokeUserTokenDocument = new TypedDocumentString(`
    mutation AdminRevokeUserToken($userId: String!, $id: ID!) {
  revokeUserToken(userId: $userId, id: $id) {
    id
    revokedAtUnix
  }
}
    `) as unknown as TypedDocumentString<
  AdminRevokeUserTokenMutation,
  AdminRevokeUserTokenMutationVariables
>;
export const AdminGroupsDocument = new TypedDocumentString(`
    query AdminGroups {
  groups {
    id
    name
  }
}
    `) as unknown as TypedDocumentString<AdminGroupsQuery, AdminGroupsQueryVariables>;
export const AdminGroupDocument = new TypedDocumentString(`
    query AdminGroup($id: String!) {
  groups {
    id
    name
  }
  groupMembers(groupId: $id) {
    id
    name
    email
    username
  }
}
    `) as unknown as TypedDocumentString<AdminGroupQuery, AdminGroupQueryVariables>;
export const AdminSearchUsersDocument = new TypedDocumentString(`
    query AdminSearchUsers($query: String!, $limit: Int) {
  searchUsers(query: $query, limit: $limit) {
    id
    name
    email
    username
  }
}
    `) as unknown as TypedDocumentString<AdminSearchUsersQuery, AdminSearchUsersQueryVariables>;
export const AdminCreateGroupDocument = new TypedDocumentString(`
    mutation AdminCreateGroup($name: String!) {
  createGroup(name: $name) {
    id
    name
  }
}
    `) as unknown as TypedDocumentString<
  AdminCreateGroupMutation,
  AdminCreateGroupMutationVariables
>;
export const AdminAddGroupMemberDocument = new TypedDocumentString(`
    mutation AdminAddGroupMember($userId: String!, $groupId: String!) {
  addGroupMember(userId: $userId, groupId: $groupId)
}
    `) as unknown as TypedDocumentString<
  AdminAddGroupMemberMutation,
  AdminAddGroupMemberMutationVariables
>;
export const AdminRemoveGroupMemberDocument = new TypedDocumentString(`
    mutation AdminRemoveGroupMember($userId: String!, $groupId: String!) {
  removeGroupMember(userId: $userId, groupId: $groupId)
}
    `) as unknown as TypedDocumentString<
  AdminRemoveGroupMemberMutation,
  AdminRemoveGroupMemberMutationVariables
>;
export const MeDocument = new TypedDocumentString(`
    query Me($id: String!) {
  user(id: $id) {
    ...UserFields
  }
}
    fragment UserFields on User {
  id
  name
  username
  email
  roles
  isRoot
  emailVerified
  disabled
}`) as unknown as TypedDocumentString<MeQuery, MeQueryVariables>;
export const ShellCountsDocument = new TypedDocumentString(`
    query ShellCounts($userId: String!) {
  activeLeasesForUser(userId: $userId) {
    id
    secretId
    expiresAt
  }
  approvalRequests {
    id
    status
    requestedByUserId
  }
  pendingSecretUses {
    id
  }
}
    `) as unknown as TypedDocumentString<ShellCountsQuery, ShellCountsQueryVariables>;
export const MyNotificationsDocument = new TypedDocumentString(`
    query MyNotifications($limit: Int) {
  myNotifications(limit: $limit) {
    id
    action
    resourceKind
    resourceId
    resourceLabel
    actorLabel
    occurredAt
    read
  }
  myUnreadNotificationCount
}
    `) as unknown as TypedDocumentString<MyNotificationsQuery, MyNotificationsQueryVariables>;
export const UnreadCountDocument = new TypedDocumentString(`
    query UnreadCount {
  myUnreadNotificationCount
}
    `) as unknown as TypedDocumentString<UnreadCountQuery, UnreadCountQueryVariables>;
export const MarkNotificationReadDocument = new TypedDocumentString(`
    mutation MarkNotificationRead($id: ID!) {
  markNotificationRead(id: $id)
}
    `) as unknown as TypedDocumentString<
  MarkNotificationReadMutation,
  MarkNotificationReadMutationVariables
>;
export const MarkAllNotificationsReadDocument = new TypedDocumentString(`
    mutation MarkAllNotificationsRead {
  markAllNotificationsRead
}
    `) as unknown as TypedDocumentString<
  MarkAllNotificationsReadMutation,
  MarkAllNotificationsReadMutationVariables
>;
export const ApplianceStatusDocument = new TypedDocumentString(`
    query ApplianceStatus {
  appliance {
    maintenance
    maintenanceReason
    mcp
  }
}
    `) as unknown as TypedDocumentString<ApplianceStatusQuery, ApplianceStatusQueryVariables>;
export const DiagnosticsDocument = new TypedDocumentString(`
    query Diagnostics {
  diagnostics {
    generatedAt
    traceId
    publicUrl
    appliance
    actor {
      id
      username
      roles
    }
    gateway {
      ...ComponentVersionFields
    }
    services {
      ...ComponentVersionFields
    }
    thirdParty {
      ...ComponentVersionFields
    }
  }
}
    fragment ComponentVersionFields on ComponentVersion {
  name
  version
  commit
  status
  dependencies {
    name
    state
    required
    error
    version
  }
}`) as unknown as TypedDocumentString<DiagnosticsQuery, DiagnosticsQueryVariables>;
export const BreakGlassCurrentDocument = new TypedDocumentString(`
    query BreakGlassCurrent {
  breakGlassSession {
    id
    reason
    openedAt
    expiresAt
  }
}
    `) as unknown as TypedDocumentString<BreakGlassCurrentQuery, BreakGlassCurrentQueryVariables>;
export const BreakGlassExitDocument = new TypedDocumentString(`
    mutation BreakGlassExit($id: ID!) {
  closeBreakGlassSession(id: $id) {
    id
    endedAt
    endReason
  }
}
    `) as unknown as TypedDocumentString<BreakGlassExitMutation, BreakGlassExitMutationVariables>;
export const AgentsTokensDocument = new TypedDocumentString(`
    query AgentsTokens {
  myTokens {
    ...AgentsTokenFields
  }
}
    fragment AgentsTokenFields on UserToken {
  id
  label
  clientName
  createdAtUnix
  lastUsedAtUnix
  expiresAtUnix
  revokedAtUnix
}`) as unknown as TypedDocumentString<AgentsTokensQuery, AgentsTokensQueryVariables>;
export const AgentsRevokeTokenDocument = new TypedDocumentString(`
    mutation AgentsRevokeToken($id: ID!) {
  revokeMyToken(id: $id) {
    ...AgentsTokenFields
  }
}
    fragment AgentsTokenFields on UserToken {
  id
  label
  clientName
  createdAtUnix
  lastUsedAtUnix
  expiresAtUnix
  revokedAtUnix
}`) as unknown as TypedDocumentString<
  AgentsRevokeTokenMutation,
  AgentsRevokeTokenMutationVariables
>;
export const AgentsPendingUsesDocument = new TypedDocumentString(`
    query AgentsPendingUses {
  secretUsesToDecide {
    ...AgentsUseFields
  }
  pendingSecretUses {
    ...AgentsUseFields
  }
}
    fragment AgentsUseFields on SecretUse {
  id
  secretName
  fieldKey
  argv
  clientLabel
  state
  expiresAtUnix
  reveal
  runId
  confirm
  requestedBy
}`) as unknown as TypedDocumentString<AgentsPendingUsesQuery, AgentsPendingUsesQueryVariables>;
export const AgentsDecideUseDocument = new TypedDocumentString(`
    mutation AgentsDecideUse($id: ID!, $approve: Boolean!, $factor: FactorInput) {
  decideSecretUse(id: $id, approve: $approve, factor: $factor) {
    ...AgentsUseFields
  }
}
    fragment AgentsUseFields on SecretUse {
  id
  secretName
  fieldKey
  argv
  clientLabel
  state
  expiresAtUnix
  reveal
  runId
  confirm
  requestedBy
}`) as unknown as TypedDocumentString<AgentsDecideUseMutation, AgentsDecideUseMutationVariables>;
export const AgentsGrantsDocument = new TypedDocumentString(`
    query AgentsGrants {
  useGrants {
    ...AgentsGrantFields
  }
  myTokens {
    ...AgentsTokenFields
  }
  folders {
    id
    name
    parentId
  }
  secretsByStatus(status: "all") {
    id
    name
    folderId
    typeId
  }
  secretTypes {
    id
    fields {
      key
      label
      sensitive
    }
  }
}
    fragment AgentsTokenFields on UserToken {
  id
  label
  clientName
  createdAtUnix
  lastUsedAtUnix
  expiresAtUnix
  revokedAtUnix
}
fragment AgentsGrantFields on UseGrant {
  id
  tokenId
  secretIds
  folderId
  fieldKeys
  programs {
    program
    argPattern
  }
  expiresAtUnix
  maxUses
  uses
  revokedAtUnix
  allowReveal
}`) as unknown as TypedDocumentString<AgentsGrantsQuery, AgentsGrantsQueryVariables>;
export const AgentsCreateGrantDocument = new TypedDocumentString(`
    mutation AgentsCreateGrant($input: UseGrantInput!, $factor: FactorInput!) {
  createUseGrant(input: $input, factor: $factor) {
    ...AgentsGrantFields
  }
}
    fragment AgentsGrantFields on UseGrant {
  id
  tokenId
  secretIds
  folderId
  fieldKeys
  programs {
    program
    argPattern
  }
  expiresAtUnix
  maxUses
  uses
  revokedAtUnix
  allowReveal
}`) as unknown as TypedDocumentString<
  AgentsCreateGrantMutation,
  AgentsCreateGrantMutationVariables
>;
export const AgentsRevokeGrantDocument = new TypedDocumentString(`
    mutation AgentsRevokeGrant($id: ID!) {
  revokeUseGrant(id: $id) {
    ...AgentsGrantFields
  }
}
    fragment AgentsGrantFields on UseGrant {
  id
  tokenId
  secretIds
  folderId
  fieldKeys
  programs {
    program
    argPattern
  }
  expiresAtUnix
  maxUses
  uses
  revokedAtUnix
  allowReveal
}`) as unknown as TypedDocumentString<
  AgentsRevokeGrantMutation,
  AgentsRevokeGrantMutationVariables
>;
export const AgentsSendFactorEmailDocument = new TypedDocumentString(`
    mutation AgentsSendFactorEmail {
  sendMfaEmailCode
}
    `) as unknown as TypedDocumentString<
  AgentsSendFactorEmailMutation,
  AgentsSendFactorEmailMutationVariables
>;
export const AgentsBeginFactorPasskeyDocument = new TypedDocumentString(`
    mutation AgentsBeginFactorPasskey {
  beginMfaPasskey {
    options
    webauthnSessionId
  }
}
    `) as unknown as TypedDocumentString<
  AgentsBeginFactorPasskeyMutation,
  AgentsBeginFactorPasskeyMutationVariables
>;
export const AgentsUseRunDocument = new TypedDocumentString(`
    query AgentsUseRun($runId: ID!) {
  secretUseRun(runId: $runId) {
    runId
    mfaFreshUntilUnix
    uses {
      ...AgentsRunUseFields
    }
  }
}
    fragment AgentsUseFields on SecretUse {
  id
  secretName
  fieldKey
  argv
  clientLabel
  state
  expiresAtUnix
  reveal
  runId
  confirm
  requestedBy
}
fragment AgentsRunUseFields on SecretUse {
  ...AgentsUseFields
  purpose
  requester
}`) as unknown as TypedDocumentString<AgentsUseRunQuery, AgentsUseRunQueryVariables>;
export const AgentsDecideUsesDocument = new TypedDocumentString(`
    mutation AgentsDecideUses($ids: [ID!]!, $decision: SecretUseDecision!, $factor: FactorInput) {
  decideSecretUses(ids: $ids, decision: $decision, factor: $factor) {
    outcomes {
      id
      decided
      reason
      use {
        ...AgentsRunUseFields
      }
    }
  }
}
    fragment AgentsUseFields on SecretUse {
  id
  secretName
  fieldKey
  argv
  clientLabel
  state
  expiresAtUnix
  reveal
  runId
  confirm
  requestedBy
}
fragment AgentsRunUseFields on SecretUse {
  ...AgentsUseFields
  purpose
  requester
}`) as unknown as TypedDocumentString<AgentsDecideUsesMutation, AgentsDecideUsesMutationVariables>;
export const AgentsConfirmUsesDocument = new TypedDocumentString(`
    mutation AgentsConfirmUses($ids: [ID!]!, $factor: FactorInput) {
  confirmSecretUses(ids: $ids, factor: $factor) {
    outcomes {
      id
      decided
      reason
      use {
        ...AgentsRunUseFields
      }
    }
  }
}
    fragment AgentsUseFields on SecretUse {
  id
  secretName
  fieldKey
  argv
  clientLabel
  state
  expiresAtUnix
  reveal
  runId
  confirm
  requestedBy
}
fragment AgentsRunUseFields on SecretUse {
  ...AgentsUseFields
  purpose
  requester
}`) as unknown as TypedDocumentString<
  AgentsConfirmUsesMutation,
  AgentsConfirmUsesMutationVariables
>;
export const BreakGlassOpenDocument = new TypedDocumentString(`
    mutation BreakGlassOpen($reason: String!, $code: String!) {
  openBreakGlassSession(reason: $reason, code: $code) {
    id
    reason
    openedAt
    expiresAt
  }
}
    `) as unknown as TypedDocumentString<BreakGlassOpenMutation, BreakGlassOpenMutationVariables>;
export const BreakGlassBrowseDocument = new TypedDocumentString(`
    query BreakGlassBrowse($sessionId: ID!) {
  breakGlassBrowse(sessionId: $sessionId) {
    folders {
      id
      name
      parentId
      scope
      ownerUserId
      isMasterPersonal
      order
    }
    secrets {
      id
      name
      folderId
      typeId
    }
  }
  secretTypes {
    id
    name
  }
}
    `) as unknown as TypedDocumentString<BreakGlassBrowseQuery, BreakGlassBrowseQueryVariables>;
export const BreakGlassOwnersDocument = new TypedDocumentString(`
    query BreakGlassOwners($ids: [String!]!) {
  resolveUserLabels(ids: $ids) {
    id
    name
  }
}
    `) as unknown as TypedDocumentString<BreakGlassOwnersQuery, BreakGlassOwnersQueryVariables>;
export const BrowseFoldersDocument = new TypedDocumentString(`
    query BrowseFolders {
  folders {
    ...BrowseFolderFields
  }
}
    fragment BrowseFolderFields on Folder {
  id
  name
  parentId
  scope
  ownerUserId
  groupId
  role
  isMasterPersonal
  order
  subtreeSecretCount
  owners
  canManage
}`) as unknown as TypedDocumentString<BrowseFoldersQuery, BrowseFoldersQueryVariables>;
export const BrowseFolderAccessDocument = new TypedDocumentString(`
    query BrowseFolderAccess($folderId: String!, $ownerIds: [String!]!) {
  myFolderAccess(folderId: $folderId) {
    read
    reveal
    manage
    approve
    informed
    manageRuleset
  }
  resolveUserLabels(ids: $ownerIds) {
    id
    name
  }
}
    `) as unknown as TypedDocumentString<BrowseFolderAccessQuery, BrowseFolderAccessQueryVariables>;
export const BrowseSecretsDocument = new TypedDocumentString(`
    query BrowseSecrets($folderId: String!, $includeRetired: Boolean) {
  secretsInFolder(folderId: $folderId, includeRetired: $includeRetired) {
    id
    name
    folderId
    typeId
    targetId
    lastHeartbeatResult
    retired
    retiredAt
    canRead
  }
  secretTypes {
    id
    name
  }
}
    `) as unknown as TypedDocumentString<BrowseSecretsQuery, BrowseSecretsQueryVariables>;
export const BrowseCreateFolderDocument = new TypedDocumentString(`
    mutation BrowseCreateFolder($parentId: String, $name: String!) {
  createFolder(parentId: $parentId, name: $name) {
    ...BrowseFolderFields
  }
}
    fragment BrowseFolderFields on Folder {
  id
  name
  parentId
  scope
  ownerUserId
  groupId
  role
  isMasterPersonal
  order
  subtreeSecretCount
  owners
  canManage
}`) as unknown as TypedDocumentString<
  BrowseCreateFolderMutation,
  BrowseCreateFolderMutationVariables
>;
export const BrowseRenameFolderDocument = new TypedDocumentString(`
    mutation BrowseRenameFolder($id: ID!, $name: String!) {
  renameFolder(id: $id, name: $name) {
    id
    name
  }
}
    `) as unknown as TypedDocumentString<
  BrowseRenameFolderMutation,
  BrowseRenameFolderMutationVariables
>;
export const BrowseMoveFolderDocument = new TypedDocumentString(`
    mutation BrowseMoveFolder($id: ID!, $newParentId: String) {
  moveFolder(id: $id, newParentId: $newParentId) {
    id
    parentId
    scope
  }
}
    `) as unknown as TypedDocumentString<
  BrowseMoveFolderMutation,
  BrowseMoveFolderMutationVariables
>;
export const BrowseDeleteFolderDocument = new TypedDocumentString(`
    mutation BrowseDeleteFolder($id: ID!, $reassignToId: String) {
  deleteFolder(id: $id, reassignToId: $reassignToId)
}
    `) as unknown as TypedDocumentString<
  BrowseDeleteFolderMutation,
  BrowseDeleteFolderMutationVariables
>;
export const BrowseReorderFoldersDocument = new TypedDocumentString(`
    mutation BrowseReorderFolders($parentId: String, $orderedIds: [String!]!) {
  reorderFolders(parentId: $parentId, orderedIds: $orderedIds)
}
    `) as unknown as TypedDocumentString<
  BrowseReorderFoldersMutation,
  BrowseReorderFoldersMutationVariables
>;
export const BrowseCreateFolderMoveRequestDocument = new TypedDocumentString(`
    mutation BrowseCreateFolderMoveRequest($folderId: String!, $destParentId: String!, $reason: String, $folderName: String, $destParentName: String) {
  createFolderMoveRequest(
    folderId: $folderId
    destParentId: $destParentId
    reason: $reason
    folderName: $folderName
    destParentName: $destParentName
  ) {
    id
    kind
    status
  }
}
    `) as unknown as TypedDocumentString<
  BrowseCreateFolderMoveRequestMutation,
  BrowseCreateFolderMoveRequestMutationVariables
>;
export const BrowseCreateSecretMoveRequestDocument = new TypedDocumentString(`
    mutation BrowseCreateSecretMoveRequest($secretId: String!, $destFolderId: String!, $reason: String, $secretName: String, $destFolderName: String) {
  createSecretMoveRequest(
    secretId: $secretId
    destFolderId: $destFolderId
    reason: $reason
    secretName: $secretName
    destFolderName: $destFolderName
  ) {
    id
    kind
    status
  }
}
    `) as unknown as TypedDocumentString<
  BrowseCreateSecretMoveRequestMutation,
  BrowseCreateSecretMoveRequestMutationVariables
>;
export const BrowseMoveSecretDocument = new TypedDocumentString(`
    mutation BrowseMoveSecret($id: ID!, $folderId: String!) {
  updateSecret(id: $id, input: { folderId: $folderId }) {
    id
    folderId
  }
}
    `) as unknown as TypedDocumentString<
  BrowseMoveSecretMutation,
  BrowseMoveSecretMutationVariables
>;
export const BrowseRestoreSecretDocument = new TypedDocumentString(`
    mutation BrowseRestoreSecret($id: String!) {
  restoreSecret(id: $id) {
    id
    retired
  }
}
    `) as unknown as TypedDocumentString<
  BrowseRestoreSecretMutation,
  BrowseRestoreSecretMutationVariables
>;
export const DashboardHomeDocument = new TypedDocumentString(`
    query DashboardHome($userId: String!, $limit: Int) {
  secretStats {
    total
    expiringSoon
    expired
    drift
  }
  topAccessedSecrets(limit: $limit) {
    id
    name
    folderId
    viewCount
    lastAccessedAt
  }
  activeLeasesForUser(userId: $userId) {
    id
    secretId
    issuedAt
    expiresAt
  }
  approvalRequests {
    id
    kind
    status
    requestedByUserId
    requestedAt
    folderName
    comments {
      id
    }
  }
  pendingSecretUses {
    id
    secretName
    fieldKey
    clientLabel
    argv
    reveal
    expiresAtUnix
  }
  folders {
    id
    name
    parentId
  }
}
    `) as unknown as TypedDocumentString<DashboardHomeQuery, DashboardHomeQueryVariables>;
export const DashboardSecretNameDocument = new TypedDocumentString(`
    query DashboardSecretName($id: ID!) {
  secret(id: $id) {
    id
    name
  }
}
    `) as unknown as TypedDocumentString<
  DashboardSecretNameQuery,
  DashboardSecretNameQueryVariables
>;
export const DashboardSecretsByStatusDocument = new TypedDocumentString(`
    query DashboardSecretsByStatus($status: String!) {
  secretsByStatus(status: $status) {
    id
    name
    typeId
    folderId
    targetId
    expiresAt
    lastHeartbeatResult
    heartbeatOptOut
  }
  folders {
    id
    name
    parentId
  }
  secretTypes {
    id
    name
  }
}
    `) as unknown as TypedDocumentString<
  DashboardSecretsByStatusQuery,
  DashboardSecretsByStatusQueryVariables
>;
export const EditorsPickersDocument = new TypedDocumentString(`
    query EditorsPickers {
  secretTypes {
    ...EditorsTypeFields
  }
  passwordPolicies {
    ...EditorsPolicyFields
  }
  folders {
    id
    name
    parentId
    scope
    canManage
  }
  targets {
    ...EditorsTargetFields
  }
  connections {
    id
    name
    protocol
    port
  }
}
    fragment EditorsTypeFields on SecretType {
  id
  name
  origin
  vendor
  checkout
  heartbeat
  rotation
  fields {
    key
    label
    kind
    options
    defaultValue
    required
    sensitive
    superSensitive
    rotates
    policyId
    policyEnforcement
    pattern
    maxLength
  }
}
fragment EditorsPolicyFields on PasswordPolicy {
  id
  name
  minLength
  maxLength
  requireUpper
  requireLower
  requireDigit
  requireSymbol
  startClass
  endLiteral
  excludeChars
  isDefault
}
fragment EditorsTargetFields on Target {
  id
  name
  hostname
  ownerUserId
}`) as unknown as TypedDocumentString<EditorsPickersQuery, EditorsPickersQueryVariables>;
export const EditorsSecretDocument = new TypedDocumentString(`
    query EditorsSecret($id: ID!) {
  secret(id: $id) {
    id
    name
    folderId
    typeId
    targetId
    expiresAt
  }
}
    `) as unknown as TypedDocumentString<EditorsSecretQuery, EditorsSecretQueryVariables>;
export const EditorsSecretFieldsDocument = new TypedDocumentString(`
    query EditorsSecretFields($id: ID!) {
  secretFields(id: $id) {
    key
    value
  }
}
    `) as unknown as TypedDocumentString<
  EditorsSecretFieldsQuery,
  EditorsSecretFieldsQueryVariables
>;
export const EditorsCreateSecretDocument = new TypedDocumentString(`
    mutation EditorsCreateSecret($input: CreateSecretInput!) {
  createSecret(input: $input) {
    id
  }
}
    `) as unknown as TypedDocumentString<
  EditorsCreateSecretMutation,
  EditorsCreateSecretMutationVariables
>;
export const EditorsUpdateSecretDocument = new TypedDocumentString(`
    mutation EditorsUpdateSecret($id: ID!, $input: UpdateSecretInput!) {
  updateSecret(id: $id, input: $input) {
    id
  }
}
    `) as unknown as TypedDocumentString<
  EditorsUpdateSecretMutation,
  EditorsUpdateSecretMutationVariables
>;
export const EditorsGenerateKeyPairDocument = new TypedDocumentString(`
    mutation EditorsGenerateKeyPair($format: String!) {
  generateKeyPair(format: $format) {
    publicKey
    privateKey
  }
}
    `) as unknown as TypedDocumentString<
  EditorsGenerateKeyPairMutation,
  EditorsGenerateKeyPairMutationVariables
>;
export const EditorsImportCertificateDocument = new TypedDocumentString(`
    mutation EditorsImportCertificate($folderId: String!, $name: String!, $fileBase64: String!, $passphrase: String, $alias: String) {
  importCertificate(
    folderId: $folderId
    name: $name
    fileBase64: $fileBase64
    passphrase: $passphrase
    alias: $alias
  ) {
    secret {
      id
    }
    aliases
  }
}
    `) as unknown as TypedDocumentString<
  EditorsImportCertificateMutation,
  EditorsImportCertificateMutationVariables
>;
export const EditorsSaveTargetDocument = new TypedDocumentString(`
    mutation EditorsSaveTarget($input: TargetInput!) {
  saveTarget(input: $input) {
    ...EditorsTargetFields
  }
}
    fragment EditorsTargetFields on Target {
  id
  name
  hostname
  ownerUserId
}`) as unknown as TypedDocumentString<
  EditorsSaveTargetMutation,
  EditorsSaveTargetMutationVariables
>;
export const RequestsListDocument = new TypedDocumentString(`
    query RequestsList {
  approvalRequests {
    ...RequestsRequestFields
  }
}
    fragment RequestsRequestFields on ApprovalRequest {
  id
  kind
  secretId
  folderId
  folderName
  destParentId
  destParentName
  requestedByUserId
  requestedAt
  reason
  status
  resolvedAt
  resolvedByUserId
  resolvedByUserName
  comments {
    id
    authorUserId
    authorName
    body
    createdAt
  }
}`) as unknown as TypedDocumentString<RequestsListQuery, RequestsListQueryVariables>;
export const RequestsSecretDocument = new TypedDocumentString(`
    query RequestsSecret($id: ID!, $secretId: String!) {
  secret(id: $id) {
    id
    name
    folderId
    typeId
  }
  mySecretAccess(secretId: $secretId) {
    read
    approve
  }
}
    `) as unknown as TypedDocumentString<RequestsSecretQuery, RequestsSecretQueryVariables>;
export const RequestsPeopleDocument = new TypedDocumentString(`
    query RequestsPeople($ids: [String!]!) {
  resolveUserLabels(ids: $ids) {
    id
    name
  }
}
    `) as unknown as TypedDocumentString<RequestsPeopleQuery, RequestsPeopleQueryVariables>;
export const RequestsResolveDocument = new TypedDocumentString(`
    mutation RequestsResolve($id: ID!, $approve: Boolean!, $grantHours: Int) {
  resolveApproval(id: $id, approve: $approve, grantHours: $grantHours) {
    ...RequestsRequestFields
  }
}
    fragment RequestsRequestFields on ApprovalRequest {
  id
  kind
  secretId
  folderId
  folderName
  destParentId
  destParentName
  requestedByUserId
  requestedAt
  reason
  status
  resolvedAt
  resolvedByUserId
  resolvedByUserName
  comments {
    id
    authorUserId
    authorName
    body
    createdAt
  }
}`) as unknown as TypedDocumentString<RequestsResolveMutation, RequestsResolveMutationVariables>;
export const RequestsCommentDocument = new TypedDocumentString(`
    mutation RequestsComment($requestId: String!, $body: String!) {
  addApprovalComment(requestId: $requestId, body: $body) {
    id
    comments {
      id
    }
  }
}
    `) as unknown as TypedDocumentString<RequestsCommentMutation, RequestsCommentMutationVariables>;
export const RequestsCreateDocument = new TypedDocumentString(`
    mutation RequestsCreate($secretId: String!, $reason: String) {
  createAccessRequest(secretId: $secretId, reason: $reason) {
    ...RequestsRequestFields
  }
}
    fragment RequestsRequestFields on ApprovalRequest {
  id
  kind
  secretId
  folderId
  folderName
  destParentId
  destParentName
  requestedByUserId
  requestedAt
  reason
  status
  resolvedAt
  resolvedByUserId
  resolvedByUserName
  comments {
    id
    authorUserId
    authorName
    body
    createdAt
  }
}`) as unknown as TypedDocumentString<RequestsCreateMutation, RequestsCreateMutationVariables>;
export const CheckoutsMineDocument = new TypedDocumentString(`
    query CheckoutsMine($userId: String!) {
  activeLeasesForUser(userId: $userId) {
    ...CheckoutsLeaseFields
  }
}
    fragment CheckoutsLeaseFields on Lease {
  id
  secretId
  userId
  issuedAt
  expiresAt
  returned
}`) as unknown as TypedDocumentString<CheckoutsMineQuery, CheckoutsMineQueryVariables>;
export const CheckoutsActiveLeaseDocument = new TypedDocumentString(`
    query CheckoutsActiveLease($secretId: String!) {
  activeLease(secretId: $secretId) {
    ...CheckoutsLeaseFields
  }
}
    fragment CheckoutsLeaseFields on Lease {
  id
  secretId
  userId
  issuedAt
  expiresAt
  returned
}`) as unknown as TypedDocumentString<
  CheckoutsActiveLeaseQuery,
  CheckoutsActiveLeaseQueryVariables
>;
export const CheckoutsCheckoutDocument = new TypedDocumentString(`
    mutation CheckoutsCheckout($secretId: String!, $hours: Int) {
  checkoutSecret(secretId: $secretId, hours: $hours) {
    ...CheckoutsLeaseFields
  }
}
    fragment CheckoutsLeaseFields on Lease {
  id
  secretId
  userId
  issuedAt
  expiresAt
  returned
}`) as unknown as TypedDocumentString<
  CheckoutsCheckoutMutation,
  CheckoutsCheckoutMutationVariables
>;
export const CheckoutsCheckinDocument = new TypedDocumentString(`
    mutation CheckoutsCheckin($secretId: String!) {
  checkinSecret(secretId: $secretId)
}
    `) as unknown as TypedDocumentString<
  CheckoutsCheckinMutation,
  CheckoutsCheckinMutationVariables
>;
export const SecretDetailDocument = new TypedDocumentString(`
    query SecretDetail($id: ID!) {
  secret(id: $id) {
    ...SecretDetailFields
  }
  secretTypes {
    id
    name
    origin
    vendor
    checkout
    heartbeat
    rotation
    fields {
      key
      label
      kind
      options
      sensitive
      superSensitive
      rotates
    }
  }
  folders {
    id
    name
    parentId
    scope
  }
  targets {
    id
    name
    hostname
  }
}
    fragment SecretDetailFields on Secret {
  id
  name
  canRead
  folderId
  typeId
  targetId
  expiresAt
  lastHeartbeatResult
  verifiedAt
  viewCount
  lastAccessedAt
  retired
  retiredAt
  lastRotationResult
  rotatedAt
  rotationIntervalDays
  nextRotationAt
  rotationOptOut
  heartbeatOptOut
  requireTokenApproval
  alwaysRequireApproval
}`) as unknown as TypedDocumentString<SecretDetailQuery, SecretDetailQueryVariables>;
export const SecretAccessDocument = new TypedDocumentString(`
    query SecretAccess($secretId: String!) {
  mySecretAccess(secretId: $secretId) {
    read
    reveal
    manage
    approve
    informed
  }
}
    `) as unknown as TypedDocumentString<SecretAccessQuery, SecretAccessQueryVariables>;
export const SecretFieldsDocument = new TypedDocumentString(`
    query SecretFields($id: ID!) {
  secretFields(id: $id) {
    key
    value
  }
}
    `) as unknown as TypedDocumentString<SecretFieldsQuery, SecretFieldsQueryVariables>;
export const SecretVersionsDocument = new TypedDocumentString(`
    query SecretVersions($secretId: ID!) {
  secretVersions(secretId: $secretId) {
    versionNo
    createdBy
    createdByName
    createdAt
    active
    fieldKeys
    changedFieldKeys
  }
}
    `) as unknown as TypedDocumentString<SecretVersionsQuery, SecretVersionsQueryVariables>;
export const SecretRevealDocument = new TypedDocumentString(`
    mutation SecretReveal($id: ID!, $fieldKey: String!) {
  revealSecretField(id: $id, fieldKey: $fieldKey)
}
    `) as unknown as TypedDocumentString<SecretRevealMutation, SecretRevealMutationVariables>;
export const SecretPrepareRevealDocument = new TypedDocumentString(`
    mutation SecretPrepareReveal($secretId: ID!, $fieldKey: String!, $runId: ID) {
  prepareSecretReveal(secretId: $secretId, fieldKey: $fieldKey, runId: $runId) {
    id
    state
    confirm
    runId
    expiresAtUnix
  }
}
    `) as unknown as TypedDocumentString<
  SecretPrepareRevealMutation,
  SecretPrepareRevealMutationVariables
>;
export const SecretRedeemRevealDocument = new TypedDocumentString(`
    mutation SecretRedeemReveal($id: ID!) {
  redeemSecretReveal(id: $id)
}
    `) as unknown as TypedDocumentString<
  SecretRedeemRevealMutation,
  SecretRedeemRevealMutationVariables
>;
export const SecretRevealVersionDocument = new TypedDocumentString(`
    mutation SecretRevealVersion($secretId: ID!, $versionNo: Int!, $fieldKey: String!) {
  revealSecretVersionField(
    secretId: $secretId
    versionNo: $versionNo
    fieldKey: $fieldKey
  )
}
    `) as unknown as TypedDocumentString<
  SecretRevealVersionMutation,
  SecretRevealVersionMutationVariables
>;
export const SecretRestoreVersionDocument = new TypedDocumentString(`
    mutation SecretRestoreVersion($secretId: ID!, $versionNo: Int!) {
  restoreSecretVersion(secretId: $secretId, versionNo: $versionNo) {
    ...SecretDetailFields
  }
}
    fragment SecretDetailFields on Secret {
  id
  name
  canRead
  folderId
  typeId
  targetId
  expiresAt
  lastHeartbeatResult
  verifiedAt
  viewCount
  lastAccessedAt
  retired
  retiredAt
  lastRotationResult
  rotatedAt
  rotationIntervalDays
  nextRotationAt
  rotationOptOut
  heartbeatOptOut
  requireTokenApproval
  alwaysRequireApproval
}`) as unknown as TypedDocumentString<
  SecretRestoreVersionMutation,
  SecretRestoreVersionMutationVariables
>;
export const SecretBreakGlassDocument = new TypedDocumentString(`
    mutation SecretBreakGlass($secretId: String!, $reason: String!, $code: String!, $sessionId: ID) {
  breakGlassSecret(
    secretId: $secretId
    reason: $reason
    code: $code
    sessionId: $sessionId
  ) {
    key
    value
  }
}
    `) as unknown as TypedDocumentString<
  SecretBreakGlassMutation,
  SecretBreakGlassMutationVariables
>;
export const SecretRotateDocument = new TypedDocumentString(`
    mutation SecretRotate($secretId: String!) {
  rotateSecret(secretId: $secretId)
}
    `) as unknown as TypedDocumentString<SecretRotateMutation, SecretRotateMutationVariables>;
export const SecretSetAutomationDocument = new TypedDocumentString(`
    mutation SecretSetAutomation($secretId: String!, $disableRotation: Boolean!, $disableHeartbeat: Boolean!) {
  setSecretAutomation(
    secretId: $secretId
    disableRotation: $disableRotation
    disableHeartbeat: $disableHeartbeat
  ) {
    ...SecretDetailFields
  }
}
    fragment SecretDetailFields on Secret {
  id
  name
  canRead
  folderId
  typeId
  targetId
  expiresAt
  lastHeartbeatResult
  verifiedAt
  viewCount
  lastAccessedAt
  retired
  retiredAt
  lastRotationResult
  rotatedAt
  rotationIntervalDays
  nextRotationAt
  rotationOptOut
  heartbeatOptOut
  requireTokenApproval
  alwaysRequireApproval
}`) as unknown as TypedDocumentString<
  SecretSetAutomationMutation,
  SecretSetAutomationMutationVariables
>;
export const SecretSetTokenApprovalDocument = new TypedDocumentString(`
    mutation SecretSetTokenApproval($secretId: String!, $required: Boolean!, $always: Boolean) {
  setSecretTokenApproval(
    secretId: $secretId
    required: $required
    always: $always
  ) {
    ...SecretDetailFields
  }
}
    fragment SecretDetailFields on Secret {
  id
  name
  canRead
  folderId
  typeId
  targetId
  expiresAt
  lastHeartbeatResult
  verifiedAt
  viewCount
  lastAccessedAt
  retired
  retiredAt
  lastRotationResult
  rotatedAt
  rotationIntervalDays
  nextRotationAt
  rotationOptOut
  heartbeatOptOut
  requireTokenApproval
  alwaysRequireApproval
}`) as unknown as TypedDocumentString<
  SecretSetTokenApprovalMutation,
  SecretSetTokenApprovalMutationVariables
>;
export const SecretRetireDocument = new TypedDocumentString(`
    mutation SecretRetire($id: String!) {
  retireSecret(id: $id) {
    ...SecretDetailFields
  }
}
    fragment SecretDetailFields on Secret {
  id
  name
  canRead
  folderId
  typeId
  targetId
  expiresAt
  lastHeartbeatResult
  verifiedAt
  viewCount
  lastAccessedAt
  retired
  retiredAt
  lastRotationResult
  rotatedAt
  rotationIntervalDays
  nextRotationAt
  rotationOptOut
  heartbeatOptOut
  requireTokenApproval
  alwaysRequireApproval
}`) as unknown as TypedDocumentString<SecretRetireMutation, SecretRetireMutationVariables>;
export const SecretRestoreDocument = new TypedDocumentString(`
    mutation SecretRestore($id: String!) {
  restoreSecret(id: $id) {
    ...SecretDetailFields
  }
}
    fragment SecretDetailFields on Secret {
  id
  name
  canRead
  folderId
  typeId
  targetId
  expiresAt
  lastHeartbeatResult
  verifiedAt
  viewCount
  lastAccessedAt
  retired
  retiredAt
  lastRotationResult
  rotatedAt
  rotationIntervalDays
  nextRotationAt
  rotationOptOut
  heartbeatOptOut
  requireTokenApproval
  alwaysRequireApproval
}`) as unknown as TypedDocumentString<SecretRestoreMutation, SecretRestoreMutationVariables>;
export const SecretDeleteDocument = new TypedDocumentString(`
    mutation SecretDelete($id: String!) {
  deleteSecret(id: $id)
}
    `) as unknown as TypedDocumentString<SecretDeleteMutation, SecretDeleteMutationVariables>;
export const SecretExportCertificateDocument = new TypedDocumentString(`
    mutation SecretExportCertificate($secretId: String!, $format: String!, $newPassphrase: String) {
  exportCertificate(
    secretId: $secretId
    format: $format
    newPassphrase: $newPassphrase
  ) {
    fileBase64
    filename
    contentType
  }
}
    `) as unknown as TypedDocumentString<
  SecretExportCertificateMutation,
  SecretExportCertificateMutationVariables
>;
export const SecretReplaceCertificateDocument = new TypedDocumentString(`
    mutation SecretReplaceCertificate($secretId: String!, $fileBase64: String!, $passphrase: String, $alias: String) {
  replaceCertificate(
    secretId: $secretId
    fileBase64: $fileBase64
    passphrase: $passphrase
    alias: $alias
  ) {
    secret {
      ...SecretDetailFields
    }
    aliases
    meta {
      ...SecretCertMetaFields
    }
  }
}
    fragment SecretDetailFields on Secret {
  id
  name
  canRead
  folderId
  typeId
  targetId
  expiresAt
  lastHeartbeatResult
  verifiedAt
  viewCount
  lastAccessedAt
  retired
  retiredAt
  lastRotationResult
  rotatedAt
  rotationIntervalDays
  nextRotationAt
  rotationOptOut
  heartbeatOptOut
  requireTokenApproval
  alwaysRequireApproval
}
fragment SecretCertMetaFields on CertMeta {
  subject
  issuer
  sans
  notBefore
  notAfter
  serialNumber
  fingerprintSha256
  keyAlgorithm
  keyBits
  isCA
  hasPrivateKey
}`) as unknown as TypedDocumentString<
  SecretReplaceCertificateMutation,
  SecretReplaceCertificateMutationVariables
>;
export const SharingFoldersDocument = new TypedDocumentString(`
    query SharingFolders {
  folders {
    id
    name
    parentId
    owners
    subtreeSecretCount
  }
}
    `) as unknown as TypedDocumentString<SharingFoldersQuery, SharingFoldersQueryVariables>;
export const SharingFolderAccessDocument = new TypedDocumentString(`
    query SharingFolderAccess($folderId: String!) {
  myFolderAccess(folderId: $folderId) {
    ...SharingAccessFields
  }
}
    fragment SharingAccessFields on FolderAccess {
  read
  reveal
  manage
  approve
  informed
  manageRuleset
}`) as unknown as TypedDocumentString<SharingFolderAccessQuery, SharingFolderAccessQueryVariables>;
export const SharingFolderRulesetDocument = new TypedDocumentString(`
    query SharingFolderRuleset($folderId: String!) {
  folderRuleset(folderId: $folderId) {
    folderId
    owners
    rules {
      ...SharingRuleFields
    }
    inherited {
      ...SharingInheritedRuleFields
    }
    inheritedOwners {
      userId
      fromFolderId
      fromFolderName
    }
  }
  groups {
    id
    name
  }
}
    fragment SharingRuleFields on RaciRule {
  id
  order
  subjectKind
  subjectName
  subjectId
  grants {
    action
    value
  }
}
fragment SharingInheritedRuleFields on InheritedRaciRule {
  fromFolderId
  fromFolderName
  rule {
    ...SharingRuleFields
  }
}`) as unknown as TypedDocumentString<
  SharingFolderRulesetQuery,
  SharingFolderRulesetQueryVariables
>;
export const SharingSecretDocument = new TypedDocumentString(`
    query SharingSecret($secretId: ID!) {
  secret(id: $secretId) {
    id
    name
    folderId
  }
}
    `) as unknown as TypedDocumentString<SharingSecretQuery, SharingSecretQueryVariables>;
export const SharingSecretAccessDocument = new TypedDocumentString(`
    query SharingSecretAccess($secretId: String!) {
  mySecretAccess(secretId: $secretId) {
    ...SharingAccessFields
  }
}
    fragment SharingAccessFields on FolderAccess {
  read
  reveal
  manage
  approve
  informed
  manageRuleset
}`) as unknown as TypedDocumentString<SharingSecretAccessQuery, SharingSecretAccessQueryVariables>;
export const SharingSecretRulesetDocument = new TypedDocumentString(`
    query SharingSecretRuleset($secretId: String!) {
  secretRuleset(secretId: $secretId) {
    secretId
    rules {
      ...SharingRuleFields
    }
    inherited {
      ...SharingInheritedRuleFields
    }
  }
  groups {
    id
    name
  }
}
    fragment SharingRuleFields on RaciRule {
  id
  order
  subjectKind
  subjectName
  subjectId
  grants {
    action
    value
  }
}
fragment SharingInheritedRuleFields on InheritedRaciRule {
  fromFolderId
  fromFolderName
  rule {
    ...SharingRuleFields
  }
}`) as unknown as TypedDocumentString<
  SharingSecretRulesetQuery,
  SharingSecretRulesetQueryVariables
>;
export const SharingUserLabelsDocument = new TypedDocumentString(`
    query SharingUserLabels($ids: [String!]!) {
  resolveUserLabels(ids: $ids) {
    id
    name
  }
}
    `) as unknown as TypedDocumentString<SharingUserLabelsQuery, SharingUserLabelsQueryVariables>;
export const SharingSearchUsersDocument = new TypedDocumentString(`
    query SharingSearchUsers($query: String!, $limit: Int) {
  searchUsers(query: $query, limit: $limit) {
    id
    name
    email
  }
}
    `) as unknown as TypedDocumentString<SharingSearchUsersQuery, SharingSearchUsersQueryVariables>;
export const SharingSimulateFolderDocument = new TypedDocumentString(`
    query SharingSimulateFolder($folderId: String!, $userId: String!, $draftRules: [RaciRuleInput!]!) {
  simulateFolder(folderId: $folderId, userId: $userId, draftRules: $draftRules) {
    ...SharingDecisionFields
  }
}
    fragment SharingDecisionFields on RaciDecision {
  read
  readReason
  reveal
  revealReason
  manage
  manageReason
  approve
  approveReason
  informed
  informedReason
}`) as unknown as TypedDocumentString<
  SharingSimulateFolderQuery,
  SharingSimulateFolderQueryVariables
>;
export const SharingSimulateSecretDocument = new TypedDocumentString(`
    query SharingSimulateSecret($secretId: String!, $userId: String!, $draftRules: [RaciRuleInput!]!) {
  simulateSecret(secretId: $secretId, userId: $userId, draftRules: $draftRules) {
    ...SharingDecisionFields
  }
}
    fragment SharingDecisionFields on RaciDecision {
  read
  readReason
  reveal
  revealReason
  manage
  manageReason
  approve
  approveReason
  informed
  informedReason
}`) as unknown as TypedDocumentString<
  SharingSimulateSecretQuery,
  SharingSimulateSecretQueryVariables
>;
export const SharingSetFolderRulesetDocument = new TypedDocumentString(`
    mutation SharingSetFolderRuleset($folderId: String!, $owners: [String!]!, $rules: [RaciRuleInput!]!) {
  setFolderRuleset(folderId: $folderId, owners: $owners, rules: $rules) {
    folderId
  }
}
    `) as unknown as TypedDocumentString<
  SharingSetFolderRulesetMutation,
  SharingSetFolderRulesetMutationVariables
>;
export const SharingSetSecretRulesetDocument = new TypedDocumentString(`
    mutation SharingSetSecretRuleset($secretId: String!, $rules: [RaciRuleInput!]!) {
  setSecretRuleset(secretId: $secretId, rules: $rules) {
    secretId
  }
}
    `) as unknown as TypedDocumentString<
  SharingSetSecretRulesetMutation,
  SharingSetSecretRulesetMutationVariables
>;
export const TargetsListDocument = new TypedDocumentString(`
    query TargetsList {
  targets {
    ...TargetsTargetFields
  }
  connections {
    ...TargetsConnectionFields
  }
}
    fragment TargetsTargetFields on Target {
  id
  name
  hostname
  kind
  domain
  realm
  connectionId
  description
  secretCount
  ownerUserId
  sshHostKeys
}
fragment TargetsConnectionFields on Connection {
  id
  name
  protocol
  port
  description
}`) as unknown as TypedDocumentString<TargetsListQuery, TargetsListQueryVariables>;
export const TargetsSaveDocument = new TypedDocumentString(`
    mutation TargetsSave($input: TargetInput!) {
  saveTarget(input: $input) {
    ...TargetsTargetFields
  }
}
    fragment TargetsTargetFields on Target {
  id
  name
  hostname
  kind
  domain
  realm
  connectionId
  description
  secretCount
  ownerUserId
  sshHostKeys
}`) as unknown as TypedDocumentString<TargetsSaveMutation, TargetsSaveMutationVariables>;
export const TargetsDeleteDocument = new TypedDocumentString(`
    mutation TargetsDelete($id: ID!) {
  deleteTarget(id: $id)
}
    `) as unknown as TypedDocumentString<TargetsDeleteMutation, TargetsDeleteMutationVariables>;
export const TargetsTerminalDocument = new TypedDocumentString(`
    query TargetsTerminal($id: ID!) {
  secret(id: $id) {
    id
    name
    typeId
    targetId
    retired
    canRead
  }
  targets {
    id
    name
    hostname
    connectionId
    sshHostKeys
  }
  connections {
    id
    protocol
    port
  }
}
    `) as unknown as TypedDocumentString<TargetsTerminalQuery, TargetsTerminalQueryVariables>;
export const TargetsTerminalFieldsDocument = new TypedDocumentString(`
    query TargetsTerminalFields($id: ID!) {
  secretFields(id: $id) {
    key
    value
  }
}
    `) as unknown as TypedDocumentString<
  TargetsTerminalFieldsQuery,
  TargetsTerminalFieldsQueryVariables
>;
export const TargetsOpenSshSessionDocument = new TypedDocumentString(`
    mutation TargetsOpenSshSession($secretId: ID!) {
  openSshSession(secretId: $secretId) {
    wsUrl
    ticket
    sessionId
    expiresInSeconds
  }
}
    `) as unknown as TypedDocumentString<
  TargetsOpenSshSessionMutation,
  TargetsOpenSshSessionMutationVariables
>;
