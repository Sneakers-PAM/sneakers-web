// @vitest-environment node
import {
  auth,
  CheckoutsActiveLeaseDocument,
  CheckoutsCheckinDocument,
  CheckoutsCheckoutDocument,
  CheckoutsMineDocument,
  GatewayClient,
  GraphQLRequestError,
  RequestsCommentDocument,
  RequestsCreateDocument,
  RequestsListDocument,
  RequestsPeopleDocument,
  RequestsResolveDocument,
  RequestsSecretDocument,
  ShellCountsDocument,
  stepUp,
} from "@sneakers-web/api-client";

import { settings } from "#mock/admin/settings";
import { MOCK_GATEWAY_URL, MOCK_SESSION_COOKIE, mockState } from "#mock/state";
import { sessionCookie, withMockGateway } from "#mock/testing";

withMockGateway();

const ALICE = "mock-user-alice";
const BOB = "mock-user-bob";
const CAROL = "mock-user-carol";
const HOUR = 3_600_000;

const as = async (userId: string) => {
  const gw = new GatewayClient({
    baseUrl: MOCK_GATEWAY_URL,
    cookieHeader: sessionCookie(userId),
    sessionCookie: MOCK_SESSION_COOKIE,
  });
  await auth.getSession(gw);
  return gw;
};

const refusal = async (p: Promise<unknown>) => {
  const error = await p.then(
    () => null,
    (error_: unknown) => error_,
  );
  expect(error).toBeInstanceOf(GraphQLRequestError);
  const refused = error as GraphQLRequestError;
  return { code: refused.code, metadata: refused.metadata, reason: refused.reason };
};

const world = () => mockState.world;
const requestById = (id: string) => world().requests.find((r) => r.id === id);
const hoursOf = (l: { expiresAt: string; issuedAt: string }) =>
  Math.round((Date.parse(l.expiresAt) - Date.parse(l.issuedAt)) / HOUR);

const counts = async (userId: string) => {
  const gw = await as(userId);
  const d = await gw.gql(ShellCountsDocument, { userId });
  return {
    leases: d.activeLeasesForUser.length,
    pending: d.approvalRequests.filter((r) => r.status === "pending").length,
  };
};

describe("requests in the mock gateway", () => {
  it("lists every request with its thread, as the gateway does", async () => {
    const gw = await as(BOB);
    const { approvalRequests } = await gw.gql(RequestsListDocument);
    expect(approvalRequests.map((r) => r.id)).toEqual(world().requests.map((r) => r.id));
    const two = approvalRequests.find((r) => r.id === "mock-req-2");
    expect(two?.comments.map((c) => c.authorName)).toEqual(["Alice"]);
  });

  it("names a secret with what the caller may do, never its values", async () => {
    const alice = await as(ALICE);
    const named = await alice.gql(RequestsSecretDocument, {
      id: "mock-secret-acme-vpn",
      secretId: "mock-secret-acme-vpn",
    });
    expect(named.secret?.name).toBe("Acme VPN");
    expect(named.mySecretAccess).toEqual({ approve: true, read: true });
    expect(JSON.stringify(named)).not.toContain("mock-Lace-Up");

    const bob = await as(BOB);
    const asked = await bob.gql(RequestsSecretDocument, {
      id: "mock-secret-acme-vpn",
      secretId: "mock-secret-acme-vpn",
    });
    expect(asked.mySecretAccess.approve).toBe(false);

    const locked = await bob.gql(RequestsSecretDocument, {
      id: "mock-secret-helpdesk",
      secretId: "mock-secret-helpdesk",
    });
    expect(locked.secret?.name).toBe("Helpdesk reset account");
    expect(locked.mySecretAccess.read).toBe(false);

    const hidden = await bob.gql(RequestsSecretDocument, {
      id: "mock-secret-alice-wifi",
      secretId: "mock-secret-alice-wifi",
    });
    expect(hidden.secret).toBeNull();
  });

  it("resolves people's names", async () => {
    const gw = await as(BOB);
    const { resolveUserLabels } = await gw.gql(RequestsPeopleDocument, {
      ids: [ALICE, "mock-user-dave", "mock-user-nobody"],
    });
    expect(resolveUserLabels).toEqual([
      { id: ALICE, name: "Alice" },
      { id: "mock-user-dave", name: "Dave" },
    ]);
  });

  it("approves an access request: it leaves the count and the requester holds a lease", async () => {
    const before = await counts(ALICE);
    const gw = await as(ALICE);
    const { resolveApproval } = await gw.gql(RequestsResolveDocument, {
      approve: true,
      grantHours: 30,
      id: "mock-req-2",
    });
    expect(resolveApproval).toMatchObject({
      resolvedByUserId: ALICE,
      resolvedByUserName: "Alice",
      status: "approved",
    });
    const lease = world().leases.find(
      (l) => l.userId === "mock-user-dave" && l.secretId === "mock-secret-db-admin" && !l.returned,
    );
    expect(lease && hoursOf(lease)).toBe(24);
    expect(await counts(ALICE)).toMatchObject({ pending: before.pending - 1 });
  });

  it("denies a request without granting anything", async () => {
    const gw = await as(ALICE);
    const before = world().leases.length;
    const { resolveApproval } = await gw.gql(RequestsResolveDocument, {
      approve: false,
      id: "mock-req-2",
    });
    expect(resolveApproval.status).toBe("denied");
    expect(world().leases).toHaveLength(before);
  });

  it("refuses a requester resolving their own request", async () => {
    const gw = await as(BOB);
    expect(
      await refusal(gw.gql(RequestsResolveDocument, { approve: true, id: "mock-req-1" })),
    ).toMatchObject({ code: "PERMISSION_DENIED", reason: "SELF_APPROVAL" });
    expect(requestById("mock-req-1")?.status).toBe("pending");
  });

  it("refuses someone who can't approve the secret", async () => {
    world().requests.push({
      ...requestById("mock-req-2")!,
      id: "mock-req-x",
      requestedByUserId: ALICE,
    });
    const gw = await as(BOB);
    expect(
      await refusal(gw.gql(RequestsResolveDocument, { approve: true, id: "mock-req-x" })),
    ).toMatchObject({ code: "PERMISSION_DENIED", reason: "NOT_APPROVER" });
  });

  it("refuses resolving a request that isn't pending", async () => {
    const gw = await as(ALICE);
    expect(
      await refusal(gw.gql(RequestsResolveDocument, { approve: false, id: "mock-req-4" })),
    ).toMatchObject({ code: "FAILED_PRECONDITION", reason: "REQUEST_NOT_PENDING" });
    expect(requestById("mock-req-4")?.status).toBe("denied");
  });

  it("refuses approving while someone else holds the secret", async () => {
    const gw = await as(CAROL);
    expect(
      await refusal(gw.gql(RequestsResolveDocument, { approve: true, id: "mock-req-1" })),
    ).toMatchObject({
      code: "FAILED_PRECONDITION",
      metadata: { holder_user_id: ALICE },
      reason: "CHECKOUT_LEASE_HELD",
    });
  });

  it("answers an unknown request with NOT_FOUND", async () => {
    const gw = await as(ALICE);
    expect(
      await refusal(gw.gql(RequestsResolveDocument, { approve: true, id: "mock-req-none" })),
    ).toMatchObject({ code: "NOT_FOUND" });
  });

  it("adds a comment to the thread, named for its author", async () => {
    const gw = await as(BOB);
    await gw.gql(RequestsCommentDocument, {
      body: "  Tonight, after nine.  ",
      requestId: "mock-req-1",
    });
    expect(requestById("mock-req-1")?.comments.at(-1)).toMatchObject({
      authorName: "Bob",
      authorUserId: BOB,
      body: "Tonight, after nine.",
    });
    expect(
      await refusal(
        gw.gql(RequestsCommentDocument, { body: " ".repeat(3), requestId: "mock-req-1" }),
      ),
    ).toMatchObject({ code: "INVALID_ARGUMENT" });
  });

  it("creates an access request that the frame counts", async () => {
    const before = await counts(BOB);
    const gw = await as(BOB);
    const { createAccessRequest } = await gw.gql(RequestsCreateDocument, {
      reason: "Patch night",
      secretId: "mock-secret-helpdesk",
    });
    expect(createAccessRequest).toMatchObject({
      folderName: "Helpdesk",
      kind: "secret_access",
      reason: "Patch night",
      requestedByUserId: BOB,
      secretId: "mock-secret-helpdesk",
      status: "pending",
    });
    expect(await counts(BOB)).toMatchObject({ pending: before.pending + 1 });
    expect(
      await refusal(gw.gql(RequestsCreateDocument, { secretId: "mock-secret-none" })),
    ).toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("checkouts in the mock gateway", () => {
  it("lists the caller's active leases, the same ones the frame counts", async () => {
    const gw = await as(ALICE);
    const mine = await gw.gql(CheckoutsMineDocument, { userId: ALICE });
    const shell = await gw.gql(ShellCountsDocument, { userId: ALICE });
    expect(mine.activeLeasesForUser.map((l) => l.id)).toEqual(
      shell.activeLeasesForUser.map((l) => l.id),
    );
    expect(mine.activeLeasesForUser.map((l) => l.secretId)).toContain("mock-secret-acme-vpn");
  });

  it("checks a secret in and out again, by secret id, and the counts follow", async () => {
    const gw = await as(ALICE);
    const start = await counts(ALICE);
    const back = await gw.gql(CheckoutsCheckinDocument, { secretId: "mock-secret-acme-vpn" });
    expect(back.checkinSecret).toBe(true);
    expect(world().leases.find((l) => l.id === "mock-lease-1")?.returned).toBe(true);
    const free = await gw.gql(CheckoutsActiveLeaseDocument, { secretId: "mock-secret-acme-vpn" });
    expect(free.activeLease).toBeNull();
    expect(await counts(ALICE)).toMatchObject({ leases: start.leases - 1 });

    const { checkoutSecret } = await gw.gql(CheckoutsCheckoutDocument, {
      hours: 2,
      secretId: "mock-secret-acme-vpn",
    });
    expect(checkoutSecret).toMatchObject({
      returned: false,
      secretId: "mock-secret-acme-vpn",
      userId: ALICE,
    });
    expect(hoursOf(checkoutSecret)).toBe(2);
    const held = await gw.gql(CheckoutsActiveLeaseDocument, { secretId: "mock-secret-acme-vpn" });
    expect(held.activeLease?.id).toBe(checkoutSecret.id);
    expect(await counts(ALICE)).toMatchObject({ leases: start.leases });
  });

  it("uses four hours when no window is given", async () => {
    const gw = await as(ALICE);
    await gw.gql(CheckoutsCheckinDocument, { secretId: "mock-secret-acme-vpn" });
    const { checkoutSecret } = await gw.gql(CheckoutsCheckoutDocument, {
      secretId: "mock-secret-acme-vpn",
    });
    expect(hoursOf(checkoutSecret)).toBe(4);
  });

  it("refuses a type with no check-out", async () => {
    const gw = await as(ALICE);
    expect(
      await refusal(gw.gql(CheckoutsCheckoutDocument, { secretId: "mock-secret-db-admin" })),
    ).toMatchObject({ code: "FAILED_PRECONDITION", reason: "CHECKOUT_TYPE_DISABLED" });
  });

  it("refuses a secret someone holds, naming the holder", async () => {
    const gw = await as(ALICE);
    expect(
      await refusal(gw.gql(CheckoutsCheckoutDocument, { secretId: "mock-secret-build-ssh" })),
    ).toMatchObject({
      code: "FAILED_PRECONDITION",
      metadata: { holder_user_id: BOB },
      reason: "CHECKOUT_LEASE_HELD",
    });
  });

  it("refuses a locked secret with CHECKOUT_NO_ACCESS", async () => {
    const gw = await as(BOB);
    expect(
      await refusal(gw.gql(CheckoutsCheckoutDocument, { secretId: "mock-secret-helpdesk" })),
    ).toMatchObject({ code: "PERMISSION_DENIED", reason: "CHECKOUT_NO_ACCESS" });
  });

  it("refuses checking in someone else's lease", async () => {
    const gw = await as(ALICE);
    expect(
      await refusal(gw.gql(CheckoutsCheckinDocument, { secretId: "mock-secret-build-ssh" })),
    ).toMatchObject({ code: "PERMISSION_DENIED", reason: "CHECKIN_NOT_HOLDER" });
    expect(world().leases.find((l) => l.id === "mock-lease-2")?.returned).toBe(false);
  });
});

// The workflow asks for a fresh MFA before checking out a type with a super-sensitive field.
const sensitiveAd = () => {
  const t = world().secretTypes.find((x) => x.id === "type-active-directory")!;
  t.fields = t.fields.map((f) => (f.key === "password" ? { ...f, superSensitive: true } : f));
};

describe("sensitive check-out in the mock gateway", () => {
  const VPN = "mock-secret-acme-vpn";
  const free = async (gw: GatewayClient) => {
    await gw.gql(CheckoutsCheckinDocument, { secretId: VPN });
    return gw;
  };

  it("asks for a step-up before checking out a sensitive type, and issues no lease", async () => {
    sensitiveAd();
    const gw = await free(await as(ALICE));
    expect(await refusal(gw.gql(CheckoutsCheckoutDocument, { secretId: VPN }))).toMatchObject({
      code: "FAILED_PRECONDITION",
      reason: "STEP_UP_REQUIRED",
    });
    const { activeLease } = await gw.gql(CheckoutsActiveLeaseDocument, { secretId: VPN });
    expect(activeLease).toBeNull();
    expect(await stepUp(gw, { code: "123456", kind: "totp" })).toBe("ok");
    const { checkoutSecret } = await gw.gql(CheckoutsCheckoutDocument, { secretId: VPN });
    expect(checkoutSecret).toMatchObject({ secretId: VPN, userId: ALICE });
  });

  it("checks a sensitive type out without a step-up when the setting is off", async () => {
    sensitiveAd();
    settings.security.requireMfaForSensitiveCheckout = false;
    const gw = await free(await as(ALICE));
    const { checkoutSecret } = await gw.gql(CheckoutsCheckoutDocument, { secretId: VPN });
    expect(checkoutSecret.secretId).toBe(VPN);
  });

  it("needs no step-up for an ordinary type", async () => {
    const gw = await free(await as(ALICE));
    const { checkoutSecret } = await gw.gql(CheckoutsCheckoutDocument, { secretId: VPN });
    expect(checkoutSecret.secretId).toBe(VPN);
  });
});
