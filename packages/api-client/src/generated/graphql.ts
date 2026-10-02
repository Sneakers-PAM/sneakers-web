/* eslint-disable */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  T | { [P in keyof T]?: P extends " $fragmentName" | "__typename" ? T[P] : never };
import type { DocumentTypeDecoration } from "@graphql-typed-document-node/core";
export type ApprovalStatus = "approved" | "denied" | "pending";

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
