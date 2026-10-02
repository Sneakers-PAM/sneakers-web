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
import { db } from "#mock/state";

export const api = graphql.link("/graphql");

/** The gateway answers an unauthenticated /graphql call with 401, never with data. */
export const unauthenticated = () =>
  HttpResponse.json({ error: "no_session" } as never, { status: 401 });

export const mfaRequired = () =>
  HttpResponse.json({ error: "mfa_required" } as never, { status: 403 });

/** Run `fn` as the signed-in mock user, or answer the way the gateway does without one. */
export const asUser = <T>(request: Request, function_: (userId: string) => T) => {
  const s = authed(request);
  if (!s) return unauthenticated();
  if (s.enrollmentRequired) return mfaRequired();
  return function_(s.userId);
};

const unread = () => db.inbox.filter((n) => !n.read).length;

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

  api.query(ShellCountsDocument, ({ request }) =>
    asUser(request, (userId) =>
      HttpResponse.json({
        data: {
          activeLeasesForUser:
            userId === "mock-user-alice"
              ? [
                  {
                    expiresAt: new Date(Date.now() + 2 * 3_600_000).toISOString(),
                    id: "mock-lease-1",
                    secretId: "mock-secret-acme-vpn",
                  },
                ]
              : [],
          approvalRequests: [
            { id: "mock-req-1", requestedByUserId: "mock-user-bob", status: "pending" },
            { id: "mock-req-2", requestedByUserId: "mock-user-dave", status: "pending" },
            { id: "mock-req-3", requestedByUserId: "mock-user-bob", status: "approved" },
          ],
          pendingSecretUses: userId === "mock-user-alice" ? [{ id: "mock-use-1" }] : [],
        },
      }),
    ),
  ),

  api.query(MyNotificationsDocument, ({ request, variables }) =>
    asUser(request, () =>
      HttpResponse.json({
        data: {
          myNotifications: db.inbox.slice(0, variables.limit ?? 50),
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
      db.inbox = db.inbox.map((n) => (n.id === variables.id ? { ...n, read: true } : n));
      return HttpResponse.json({ data: { markNotificationRead: true } });
    }),
  ),

  api.mutation(MarkAllNotificationsReadDocument, ({ request }) =>
    asUser(request, () => {
      db.inbox = db.inbox.map((n) => ({ ...n, read: true }));
      return HttpResponse.json({ data: { markAllNotificationsRead: true } });
    }),
  ),
];
