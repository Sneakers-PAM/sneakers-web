/* eslint-disable */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  T | { [P in keyof T]?: P extends " $fragmentName" | "__typename" ? T[P] : never };
import type { DocumentTypeDecoration } from "@graphql-typed-document-node/core";
export type ApprovalStatus = "approved" | "denied" | "pending";

export type FieldKind =
  "boolean" | "file" | "multiline" | "password" | "select" | "sensitive" | "text";

export type FolderScope = "group" | "personal" | "role";

export type HeartbeatResult =
  "failed" | "hostKeyMismatch" | "hostKeyNotPinned" | "ok" | "unknown" | "unreachable";

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

export type RequestKind = "folder_move" | "secret_access" | "secret_move";

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

export type SecuritySettingsInput = {
  allowApiForSensitive?: boolean | null | undefined;
  defaultPasswordPolicyId?: string | null | undefined;
  requestHistoryRetentionDays?: number | null | undefined;
  requireMfaForReveal?: boolean | null | undefined;
  requireMfaForSensitiveCheckout?: boolean | null | undefined;
  sessionTtlSeconds?: number | null | undefined;
};

export type TypeOrigin = "custom" | "extension" | "system";

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
