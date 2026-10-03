// @vitest-environment node
import { MOCK_GATEWAY_URL, mockState } from "@sneakers-web/mock-gateway";
import {
  appRequest,
  server,
  sessionCookie,
  withMockGateway,
} from "@sneakers-web/mock-gateway/testing";
import { HttpResponse } from "msw";
import { graphql } from "msw/graphql";

import { loadDashboard, loadSecretsByStatus } from "@/features/dashboard/dashboard.server";

withMockGateway();

const api = graphql.link(`${MOCK_GATEWAY_URL}/graphql`);
const as = (user: string, path = "/") => appRequest(path, { cookie: sessionCookie(user) });

const refuse = (operation: string, code: string, reason?: string) =>
  server.use(
    api.query(operation, () =>
      HttpResponse.json({
        errors: [{ extensions: { code, reason }, message: `rpc error: code = X desc = ${code}` }],
      }),
    ),
  );

describe("the dashboard loader", () => {
  it("gives Alice her tiles, her quick cards and her most-opened secrets", async () => {
    const d = await loadDashboard(as("mock-user-alice"));
    if (!d.ok) throw new Error("expected data");
    expect(d.stats).toEqual({ drift: 2, expired: 1, expiringSoon: 2, total: 10 });
    expect(d.agents).toEqual([
      expect.objectContaining({
        clientLabel: "Build agent on build1",
        command: "psql -h db1.example.org -U postgres_admin",
        fieldKey: "password",
        id: "mock-use-1",
        secretName: "DB admin",
      }),
    ]);
    expect(d.checkouts).toEqual([
      expect.objectContaining({
        id: "mock-lease-1",
        secretId: "mock-secret-acme-vpn",
        secretName: "Acme VPN",
      }),
    ]);
    expect(d.requests).toEqual([]);
    expect(d.top.map((s) => [s.name, s.folderPath])).toEqual([
      ["Status page API", "Platform"],
      ["Acme VPN", "Platform / Network"],
      ["DB admin", "Platform / Databases"],
      ["Build host deploy key", "Platform"],
      ["Payroll portal", "Finance"],
    ]);
  });

  it("shows Bob his own pending request and his checkout", async () => {
    const d = await loadDashboard(as("mock-user-bob"));
    if (!d.ok) throw new Error("expected data");
    expect(d.requests).toEqual([
      expect.objectContaining({ folderName: "Platform / Network", id: "mock-req-1", messages: 0 }),
    ]);
    expect(d.checkouts.map((c) => c.secretName)).toEqual(["Build host deploy key"]);
    expect(d.agents).toEqual([]);
  });

  it("names a checkout by its id when the secret can't be looked up", async () => {
    mockState.world.leases.push({
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      id: "mock-lease-hidden",
      issuedAt: new Date().toISOString(),
      returned: false,
      secretId: "mock-secret-bob-laptop",
      userId: "mock-user-alice",
    });
    const d = await loadDashboard(as("mock-user-alice"));
    if (!d.ok) throw new Error("expected data");
    expect(d.checkouts.find((c) => c.id === "mock-lease-hidden")?.secretName).toBe("A secret");
  });

  it("hands back a refusal as data, with a retry when trying again could help", async () => {
    refuse("DashboardHome", "UNAVAILABLE");
    const d = await loadDashboard(as("mock-user-alice"));
    expect(d).toMatchObject({ failure: { code: "UNAVAILABLE", retry: true }, ok: false });

    server.resetHandlers();
    refuse("DashboardHome", "PERMISSION_DENIED", "NOT_FOLDER_OWNER");
    const denied = await loadDashboard(as("mock-user-alice"));
    expect(denied).toMatchObject({
      failure: { reason: "NOT_FOLDER_OWNER", retry: false },
      ok: false,
    });
  });

  it("sends someone without a session to sign in", async () => {
    const error = await loadDashboard(appRequest("/")).catch((error_: unknown) => error_);
    expect(error).toBeInstanceOf(Response);
    expect((error as Response).headers.get("Location")).toMatch(/^\/sign-in\?next=%2F/);
  });
});

describe("the secrets-by-status loader", () => {
  it("lists the expiring secrets with their type, folder path and heartbeat", async () => {
    const d = await loadSecretsByStatus(as("mock-user-alice", "/secrets?status=expiring"));
    if (!d.ok) throw new Error("expected data");
    expect(d.status).toBe("expiring");
    expect(d.rows).toEqual([
      expect.objectContaining({
        expiry: "soon",
        folderPath: "Platform / Certificates",
        heartbeat: "none",
        name: "portal.example.org",
        typeName: "SSL/PKI Certificate",
      }),
      expect.objectContaining({
        expiry: "soon",
        folderPath: "Platform",
        name: "Status page API",
        typeName: "API Token",
      }),
    ]);
  });

  it("marks drift and unreachable heartbeats", async () => {
    const d = await loadSecretsByStatus(as("mock-user-alice", "/secrets?status=drift"));
    if (!d.ok) throw new Error("expected data");
    expect(d.rows.map((r) => [r.name, r.heartbeat])).toEqual([
      ["DB admin", "drift"],
      ["Edge router admin", "unreachable"],
    ]);
  });

  it("treats a status it doesn't know as all, sorted by name", async () => {
    const d = await loadSecretsByStatus(as("mock-user-alice", "/secrets?status=nope"));
    if (!d.ok) throw new Error("expected data");
    expect(d.status).toBe("all");
    expect(d.rows).toHaveLength(10);
    expect(d.rows.map((r) => r.name)).toEqual(
      d.rows.map((r) => r.name).toSorted((a, b) => a.localeCompare(b)),
    );
    expect(d.rows.find((r) => r.name === "old.example.org")?.expiry).toBe("past");
    expect(d.rows.find((r) => r.name === "Lab wifi")?.folderPath).toBe("My secrets / Lab");
  });

  it("hands back a refusal as data", async () => {
    refuse("DashboardSecretsByStatus", "UNAVAILABLE");
    const d = await loadSecretsByStatus(as("mock-user-alice", "/secrets?status=expired"));
    expect(d).toMatchObject({ failure: { retry: true }, ok: false, status: "expired" });
  });
});
