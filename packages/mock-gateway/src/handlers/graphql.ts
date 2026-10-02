import {
  MarkAllNotificationsReadDocument,
  MarkNotificationReadDocument,
  MeDocument,
  MyNotificationsDocument,
  ShellCountsDocument,
  UnreadCountDocument,
} from "@sneakers-web/api-client";
import { HttpResponse } from "msw";
import { graphql } from "msw/graphql";

import { userById } from "#mock/fixtures/users";
import { authed } from "#mock/handlers/auth";
import { MOCK_GATEWAY_URL, mockState } from "#mock/state";

export const api = graphql.link(`${MOCK_GATEWAY_URL}/graphql`);

/** The gateway answers an unauthenticated /graphql call with 401, never with data. */
export const unauthenticated = () =>
  HttpResponse.json({ error: "no_session" } as never, { status: 401 });

export const mfaRequired = () =>
  HttpResponse.json({ error: "mfa_required" } as never, { status: 403 });

/** Run `fn` as the signed-in mock user, or answer the way the gateway does without one. */
export const asUser = <T>(request: Request, run: (userId: string) => T): T => {
  const s = authed(request);
  // The gateway's 401 and 403 aren't GraphQL bodies, so they don't fit the resolver's type.
  if (!s) return unauthenticated() as unknown as T;
  if (s.enrollmentRequired) return mfaRequired() as unknown as T;
  return run(s.userId);
};

const unread = () => mockState.inbox.filter((n) => !n.read).length;

export const shellHandlers = [
  api.query(MeDocument, ({ request, variables }) =>
    asUser(request, () => {
      const u = userById(variables.id);
      return HttpResponse.json({
        data: {
          user: u
            ? {
                disabled: u.disabled,
                email: u.email,
                emailVerified: u.emailVerified,
                id: u.id,
                isRoot: u.isRoot,
                name: u.name,
                roles: u.roles,
                username: u.username,
              }
            : null,
        },
      });
    }),
  ),

  api.query(ShellCountsDocument, ({ request, variables }) =>
    asUser(request, (userId) => {
      const { leases, requests, secretUses } = mockState.world;
      return HttpResponse.json({
        data: {
          activeLeasesForUser: leases
            .filter((l) => l.userId === variables.userId && !l.returned)
            .map(({ expiresAt, id, secretId }) => ({ expiresAt, id, secretId })),
          approvalRequests: requests.map(({ id, requestedByUserId, status }) => ({
            id,
            requestedByUserId,
            status,
          })),
          pendingSecretUses: secretUses
            .filter((u) => u.ownerUserId === userId && u.state === "pending")
            .map(({ id }) => ({ id })),
        },
      });
    }),
  ),

  api.query(MyNotificationsDocument, ({ request, variables }) =>
    asUser(request, () =>
      HttpResponse.json({
        data: {
          myNotifications: mockState.inbox.slice(0, variables.limit ?? 50),
          myUnreadNotificationCount: unread(),
        },
      }),
    ),
  ),

  api.query(UnreadCountDocument, ({ request }) =>
    asUser(request, () => HttpResponse.json({ data: { myUnreadNotificationCount: unread() } })),
  ),

  api.mutation(MarkNotificationReadDocument, ({ request, variables }) =>
    asUser(request, () => {
      mockState.inbox = mockState.inbox.map((n) =>
        n.id === variables.id ? { ...n, read: true } : n,
      );
      return HttpResponse.json({ data: { markNotificationRead: true } });
    }),
  ),

  api.mutation(MarkAllNotificationsReadDocument, ({ request }) =>
    asUser(request, () => {
      mockState.inbox = mockState.inbox.map((n) => ({ ...n, read: true }));
      return HttpResponse.json({ data: { markAllNotificationsRead: true } });
    }),
  ),
];
