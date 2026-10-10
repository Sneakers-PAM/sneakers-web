import {
  ApplianceStatusDocument,
  type ComponentStatus,
  type ComponentVersionFieldsFragment,
  DiagnosticsDocument,
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
import { MOCK_GATEWAY_URL, mockState, onMockReset } from "#mock/state";

export interface MockAppliance {
  maintenance: boolean;
  maintenanceReason: null | string;
  mcp: null | string;
}

const applianceDefault = (): MockAppliance => ({
  maintenance: false,
  maintenanceReason: null,
  mcp: null,
});

/** The appliance's banner fields, as a plain Kubernetes install sees them by default. */
export const mockAppliance = { current: applianceDefault() };

onMockReset(() => {
  mockAppliance.current = applianceDefault();
});

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

type MockDependency = NonNullable<ComponentVersionFieldsFragment["dependencies"]>[number];

const mockDependency = (name: string, required = true): MockDependency => ({
  error: null,
  name,
  required,
  state: "OK",
  version: name === "postgres" ? "mock-postgres-17" : null,
});

const MOCK_DEPENDENCIES: Record<string, MockDependency[]> = {
  audit: [mockDependency("postgres")],
  identity: [mockDependency("postgres"), mockDependency("kratos"), mockDependency("audit", false)],
  notify: [mockDependency("valkey")],
  vault: [mockDependency("postgres"), mockDependency("valkey"), mockDependency("audit", false)],
  workflow: [mockDependency("postgres"), mockDependency("vault", false)],
};

const mockComponent = (
  name: string,
  status: ComponentStatus = "OK",
): ComponentVersionFieldsFragment =>
  status === "OK"
    ? {
        commit: `mock-${name}-commit`,
        dependencies: MOCK_DEPENDENCIES[name] ?? null,
        name,
        status,
        version: `mock-${name}-1.0.0`,
      }
    : { commit: null, dependencies: null, name, status, version: null };

export const shellHandlers = [
  api.query(ApplianceStatusDocument, ({ request }) =>
    asUser(request, () => HttpResponse.json({ data: { appliance: mockAppliance.current } })),
  ),

  api.query(DiagnosticsDocument, ({ request }) =>
    asUser(request, (userId) => {
      const u = userById(userId);
      return HttpResponse.json({
        data: {
          diagnostics: {
            actor: { id: userId, roles: u?.roles ?? [], username: u?.username ?? userId },
            appliance: "mock-appliance-1.0.0",
            box: null,
            gateway: mockComponent("gateway"),
            generatedAt: new Date().toISOString(),
            productVersion: "0.0.0-mock",
            publicUrl: "https://mock-gateway.example.invalid",
            services: [
              ...["identity", "vault", "workflow", "audit", "notify", "sshbroker"].map((n) =>
                mockComponent(n),
              ),
              mockComponent("connector", "NOT_CONFIGURED"),
              mockComponent("mcp", "UNAVAILABLE"),
            ],
            thirdParty: [
              ...["kratos", "hydra", "polis", "valkey", "postgres", "kubernetes"].map((n) =>
                mockComponent(n),
              ),
              mockComponent("rabbitmq", "NOT_CONFIGURED"),
            ],
            traceId: "mock-trace-0000000000000000",
          },
        },
      });
    }),
  ),

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
            .filter(
              (u) =>
                u.ownerUserId === userId &&
                u.state === "pending" &&
                u.expiresAtUnix > Math.floor(Date.now() / 1000),
            )
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
