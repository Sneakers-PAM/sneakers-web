// @vitest-environment node
import { mockState } from "@sneakers-web/mock-gateway";
import {
  appRequest,
  form,
  sessionCookie,
  withMockGateway,
} from "@sneakers-web/mock-gateway/testing";

import { loadCheckouts } from "@/features/requests/checkouts.server";
import { checkIn, checkOut } from "@/features/requests/leases.server";
import { loadRequests, requestsAction } from "@/features/requests/requests.server";

withMockGateway();

const get = (path: string, user = "mock-user-alice") =>
  appRequest(path, { cookie: sessionCookie(user) });
const post = (path: string, fields: Record<string, string>, user = "mock-user-alice") =>
  appRequest(path, { body: form(fields), cookie: sessionCookie(user), method: "POST" });

describe("the requests loader", () => {
  it("splits an approver's requests into waiting, open and history, named", async () => {
    const d = await loadRequests(get("/requests"));
    expect(d.approver).toBe(true);
    expect(d.awaiting.map((r) => [r.resource, r.requestedBy])).toEqual([
      ["Acme VPN", "Bob"],
      ["DB admin", "Dave"],
    ]);
    expect(d.awaiting.every((r) => r.canDecide)).toBe(true);
    expect(d.open).toEqual([]);
    expect(d.history.map((r) => [r.resource, r.status, r.resolvedBy])).toEqual([
      ["Payroll portal", "approved", "Alice"],
      ["Finance / Archive → Platform", "denied", "Carol"],
    ]);
    expect(d.awaiting[1]?.comments).toEqual([
      expect.objectContaining({ author: "Alice", mine: true }),
    ]);
  });

  it("shows a requester only their own requests, with nothing to approve", async () => {
    const d = await loadRequests(get("/requests", "mock-user-bob"));
    expect(d.approver).toBe(false);
    expect(d.awaiting).toEqual([]);
    expect(d.open.map((r) => [r.resource, r.canDecide])).toEqual([["Acme VPN", false]]);
    expect(d.history.map((r) => r.resource)).toEqual([
      "Payroll portal",
      "Finance / Archive → Platform",
    ]);
  });

  it("opens the request form for ?new=, and says when one is already pending", async () => {
    const fresh = await loadRequests(get("/requests?new=mock-secret-payroll", "mock-user-bob"));
    expect(fresh.asking).toEqual({
      alreadyPending: false,
      name: "Payroll portal",
      secretId: "mock-secret-payroll",
    });
    const again = await loadRequests(get("/requests?new=mock-secret-acme-vpn", "mock-user-bob"));
    expect(again.asking?.alreadyPending).toBe(true);
    const hidden = await loadRequests(get("/requests?new=mock-secret-alice-wifi", "mock-user-bob"));
    expect(hidden.asking?.name).toBeNull();
  });
});

describe("the requests action", () => {
  it("approves for the chosen hours, capped at 24", async () => {
    const r = await requestsAction(
      post("/requests", {
        decision: "approve",
        hours: "40",
        id: "mock-req-2",
        intent: "resolve",
        kind: "secret_access",
      }),
    );
    expect(r).toEqual({ done: "approved", intent: "resolve", ok: true });
    const lease = mockState.world.leases.find((l) => l.userId === "mock-user-dave");
    expect(Date.parse(lease!.expiresAt) - Date.parse(lease!.issuedAt)).toBe(24 * 3_600_000);
  });

  it("hands a refusal back as data with its reason", async () => {
    const r = await requestsAction(
      post(
        "/requests",
        { decision: "approve", id: "mock-req-1", intent: "resolve", kind: "secret_access" },
        "mock-user-bob",
      ),
    );
    expect(r).toMatchObject({ ok: false, refusal: { reason: "SELF_APPROVAL" } });
  });

  it("denies, comments and creates", async () => {
    expect(
      await requestsAction(
        post("/requests", { decision: "deny", id: "mock-req-2", intent: "resolve" }),
      ),
    ).toMatchObject({ done: "denied", ok: true });
    expect(
      await requestsAction(
        post("/requests", { body: "On it", id: "mock-req-1", intent: "comment" }),
      ),
    ).toMatchObject({ ok: true });
    expect(mockState.world.requests.find((r) => r.id === "mock-req-1")?.comments.at(-1)?.body).toBe(
      "On it",
    );
    const created = await requestsAction(
      post(
        "/requests",
        { intent: "create", reason: "Report run", secretId: "mock-secret-db-reporting" },
        "mock-user-bob",
      ),
    );
    expect(created).toMatchObject({ intent: "create", ok: true });
    expect(mockState.world.requests.at(-1)).toMatchObject({
      reason: "Report run",
      requestedByUserId: "mock-user-bob",
      secretId: "mock-secret-db-reporting",
    });
  });
});

const held = async () => {
  const d = await loadCheckouts(get("/checkouts"));
  return d.checkouts.map((c) => c.secretId);
};

describe("checkouts on the server", () => {
  it("lists the user's checkouts by secret name", async () => {
    const d = await loadCheckouts(get("/checkouts"));
    expect(d.checkouts.map((c) => [c.secretId, c.name])).toEqual([
      ["mock-secret-acme-vpn", "Acme VPN"],
    ]);
  });

  it("checks in and out by secret id, for any route that calls it", async () => {
    expect(await checkIn(post("/anywhere", {}), "mock-secret-acme-vpn")).toMatchObject({
      intent: "checkin",
      ok: true,
    });
    expect(await held()).not.toContain("mock-secret-acme-vpn");
    const out = await checkOut(post("/anywhere", {}), "mock-secret-acme-vpn", "2");
    expect(out).toMatchObject({ intent: "checkout", ok: true });
    expect(await held()).toContain("mock-secret-acme-vpn");
  });

  it("returns a held secret's refusal as data", async () => {
    expect(await checkOut(post("/anywhere", {}), "mock-secret-build-ssh")).toMatchObject({
      ok: false,
      refusal: { metadata: { holder_user_id: "mock-user-bob" }, reason: "CHECKOUT_LEASE_HELD" },
    });
  });
});
