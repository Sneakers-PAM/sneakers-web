// @vitest-environment node
import {
  auth,
  DashboardHomeDocument,
  DashboardSecretNameDocument,
  DashboardSecretsByStatusDocument,
  GatewayClient,
  GraphQLRequestError,
} from "@sneakers-web/api-client";

import { MOCK_GATEWAY_URL, MOCK_SESSION_COOKIE, mockState } from "#mock/state";
import { sessionCookie, withMockGateway } from "#mock/testing";

withMockGateway();

const DAY = 86_400_000;

const client = async (userId: string) => {
  const gw = new GatewayClient({
    baseUrl: MOCK_GATEWAY_URL,
    cookieHeader: sessionCookie(userId),
    sessionCookie: MOCK_SESSION_COOKIE,
  });
  await auth.getSession(gw);
  return gw;
};

const alice = () => client("mock-user-alice");
const ids = (rows: { id: string }[]) => rows.map((r) => r.id).toSorted();

describe("the dashboard's mock answers", () => {
  it("counts only the live secrets Alice can read", async () => {
    const gw = await alice();
    const { secretStats } = await gw.gql(DashboardHomeDocument, { userId: "mock-user-alice" });
    // Shared folders plus Alice's own; the retired portal and Bob's laptop don't count.
    expect(secretStats).toEqual({ drift: 2, expired: 1, expiringSoon: 2, total: 11 });
  });

  it("follows the world as it changes", async () => {
    const gw = await alice();
    const vpn = mockState.world.secrets.find((s) => s.id === "mock-secret-acme-vpn")!;
    vpn.expiresAt = new Date(Date.now() + 3 * DAY).toISOString();
    vpn.lastHeartbeatResult = "failed";
    const { secretStats } = await gw.gql(DashboardHomeDocument, { userId: "mock-user-alice" });
    expect(secretStats).toMatchObject({ drift: 3, expiringSoon: 3 });
  });

  it("drills into each status", async () => {
    const gw = await alice();
    const by = async (status: string) => {
      const { secretsByStatus } = await gw.gql(DashboardSecretsByStatusDocument, { status });
      return ids(secretsByStatus);
    };
    expect(await by("expiring")).toEqual(["mock-secret-portal-cert", "mock-secret-status-api"]);
    expect(await by("expired")).toEqual(["mock-secret-old-cert"]);
    expect(await by("drift")).toEqual(["mock-secret-db-admin", "mock-secret-edge-router"]);
    const all = await by("all");
    expect(all).toHaveLength(11);
    expect(all).toContain("mock-secret-alice-wifi");
    expect(all).not.toContain("mock-secret-legacy-portal");
    expect(all).not.toContain("mock-secret-bob-laptop");
  });

  it("refuses a status it doesn't know", async () => {
    const gw = await alice();
    const error = await gw
      .gql(DashboardSecretsByStatusDocument, { status: "everything" })
      .catch((error_: unknown) => error_);
    expect(error).toBeInstanceOf(GraphQLRequestError);
    expect((error as GraphQLRequestError).code).toBe("INVALID_ARGUMENT");
  });

  it("never shows one person's personal folder to another", async () => {
    const gw = await client("mock-user-bob");
    const { folders, secretsByStatus } = await gw.gql(DashboardSecretsByStatusDocument, {
      status: "all",
    });
    expect(ids(secretsByStatus)).toContain("mock-secret-bob-laptop");
    expect(ids(secretsByStatus)).not.toContain("mock-secret-alice-wifi");
    expect(ids(folders)).toContain("mock-folder-bob");
    expect(ids(folders)).not.toContain("mock-folder-alice");
    expect(ids(folders)).not.toContain("mock-folder-alice-lab");
    const name = await gw.gql(DashboardSecretNameDocument, { id: "mock-secret-alice-wifi" });
    expect(name.secret).toBeNull();
  });

  it("ranks the most-opened readable secrets", async () => {
    const gw = await alice();
    const { topAccessedSecrets } = await gw.gql(DashboardHomeDocument, {
      limit: 5,
      userId: "mock-user-alice",
    });
    expect(topAccessedSecrets.map((s) => [s.id, s.viewCount])).toEqual([
      ["mock-secret-status-api", 57],
      ["mock-secret-acme-vpn", 42],
      ["mock-secret-db-admin", 31],
      ["mock-secret-build-ssh", 18],
      ["mock-secret-payroll", 12],
    ]);
  });

  it("gives the quick cards Alice's checkouts and agent requests, not anyone else's", async () => {
    const gw = await alice();
    const d = await gw.gql(DashboardHomeDocument, { userId: "mock-user-alice" });
    expect(ids(d.activeLeasesForUser)).toEqual(["mock-lease-1"]);
    expect(ids(d.pendingSecretUses)).toEqual(["mock-use-1"]);
    expect(d.approvalRequests.length).toBe(mockState.world.requests.length);
    const name = await gw.gql(DashboardSecretNameDocument, { id: "mock-secret-acme-vpn" });
    expect(name.secret).toEqual({ id: "mock-secret-acme-vpn", name: "Acme VPN" });
  });

  it("never sends a field value", async () => {
    const gw = await alice();
    const answers = JSON.stringify([
      await gw.gql(DashboardHomeDocument, { limit: 50, userId: "mock-user-alice" }),
      await gw.gql(DashboardSecretsByStatusDocument, { status: "all" }),
    ]);
    expect(answers).not.toContain('"fields"');
    const { secrets, secretTypes } = mockState.world;
    for (const s of secrets) {
      const type = secretTypes.find((t) => t.id === s.typeId)!;
      for (const f of type.fields) {
        const value = s.fields[f.key];
        if (f.sensitive && value) expect(answers).not.toContain(value);
      }
    }
  });

  it("answers 401 without a session", async () => {
    const gw = new GatewayClient({
      baseUrl: MOCK_GATEWAY_URL,
      cookieHeader: null,
      sessionCookie: MOCK_SESSION_COOKIE,
    });
    await expect(gw.gql(DashboardSecretsByStatusDocument, { status: "all" })).rejects.toMatchObject(
      { status: 401 },
    );
  });
});
