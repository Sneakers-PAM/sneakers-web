/* eslint-disable */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  T | { [P in keyof T]?: P extends " $fragmentName" | "__typename" ? T[P] : never };
import type { DocumentTypeDecoration } from "@graphql-typed-document-node/core";
export type ApprovalStatus = "approved" | "denied" | "pending";

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
