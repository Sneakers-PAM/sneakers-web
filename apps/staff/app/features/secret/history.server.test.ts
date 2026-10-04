// @vitest-environment node
import { mockState, USERS } from "@sneakers-web/mock-gateway";
import {
  appRequest,
  form,
  sessionCookie,
  withCookie,
  withMockGateway,
} from "@sneakers-web/mock-gateway/testing";

import { browseAction } from "@/features/browse/browse.server";
import { loadSecret, secretAction, type SecretLoad } from "@/features/secret/secret.server";

withMockGateway();

const DB = "mock-secret-db-admin";
const ALICE = "mock-user-alice";
const BOB = "mock-user-bob";

const load = async (id: string, user = ALICE): Promise<SecretLoad> => {
  const run = withCookie(sessionCookie(user), ({ params, request }) =>
    loadSecret(request, params.id ?? ""),
  );
  return run({ context: {}, params: { id }, request: appRequest(`/secret/${id}`) });
};

const actWith = (cookie: string, id: string, fields: Record<string, string>) => {
  const run = withCookie(cookie, ({ params, request }) => secretAction(request, params.id ?? ""));
  return run({
    context: {},
    params: { id },
    request: appRequest(`/secret/${id}`, { body: form(fields), method: "POST" }),
  });
};

const grantRecovery = (userId = ALICE) =>
  USERS.find((u) => u.id === userId)?.roles.push("recovery");

const restore = { intent: "restore-version", versionNo: "2" };

describe("the history on the secret page", () => {
  it("lists the changes to an everyday reader, without a single value", async () => {
    const d = await load(DB, BOB);
    if (!d.ok) throw new Error("expected the page");
    expect(d.access).toMatchObject({ manage: false, read: true });
    expect(d.history?.map((v) => [v.versionNo, v.createdByName])).toEqual([
      [3, "Alice"],
      [2, "Alice"],
      [1, "Alice"],
    ]);
    expect(d.history?.[0]?.changedFieldKeys).toEqual(["username"]);
    expect(d.recovery).toBe(false);
    const sent = JSON.stringify(d);
    expect(sent).not.toContain("mock-Tongue-Eyelet-91");
    expect(sent).not.toMatch(/mock-v\d-/);
  });

  it("tells the page when the person holds the recovery role", async () => {
    grantRecovery();
    const d = await load(DB);
    expect(d.ok && d.recovery).toBe(true);
  });
});

describe("restoring a version", () => {
  it("asks for a step-up first, then restores and says so", async () => {
    grantRecovery();
    const cookie = sessionCookie(ALICE);
    expect(await actWith(cookie, DB, restore)).toMatchObject({
      intent: "restore-version",
      ok: false,
      refusal: { reason: "STEP_UP_REQUIRED" },
      versionNo: 2,
    });
    const session = [...mockState.sessions.values()].find((s) => s.userId === ALICE);
    if (session) session.mfaVerifiedAt = Date.now();
    expect(await actWith(cookie, DB, restore)).toMatchObject({
      done: "Version 2's values are the current ones now, as version 4.",
      ok: true,
      versionNo: 2,
    });
  });

  it("passes the recovery-role refusal back to the page", async () => {
    expect(await actWith(sessionCookie(ALICE), DB, restore)).toMatchObject({
      ok: false,
      refusal: { code: "PERMISSION_DENIED", reason: "RECOVERY_ROLE_REQUIRED" },
    });
  });

  it("names who holds the lease when a check-out blocks it", async () => {
    mockState.world.leases.push({
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      id: "mock-lease-history-bob",
      issuedAt: new Date().toISOString(),
      returned: false,
      secretId: DB,
      userId: BOB,
    });
    expect(await actWith(sessionCookie(ALICE), DB, restore)).toMatchObject({
      ok: false,
      refusal: {
        metadata: { holder_name: "Bob", holder_user_id: BOB },
        reason: "CHECKOUT_LEASE_HELD",
      },
    });
  });

  it("needs a version number", async () => {
    expect(
      await actWith(sessionCookie(ALICE), DB, { intent: "restore-version", versionNo: "" }),
    ).toMatchObject({ ok: false, refusal: { code: "INVALID_ARGUMENT" } });
  });
});

const moveToNetwork = () =>
  browseAction(
    appRequest("/browse/mock-folder-databases", {
      body: form({
        dest: "mock-folder-network",
        intent: "move-secrets",
        secrets: JSON.stringify([{ id: DB, name: "DB admin" }]),
      }),
      cookie: sessionCookie(ALICE),
      method: "POST",
    }),
    "mock-folder-databases",
  );

describe("folder moves in the history", () => {
  it("lists a move with its folders and adds no version", async () => {
    const before = await load(DB);
    if (!before.ok) throw new Error("expected the page");
    expect(before.moves).toEqual([]);

    expect(await moveToNetwork()).toMatchObject({ ok: true });

    const d = await load(DB);
    if (!d.ok) throw new Error("expected the page");
    expect(d.history?.map((v) => v.versionNo)).toEqual(before.history?.map((v) => v.versionNo));
    expect(d.moves).toMatchObject([
      {
        fromFolderId: "mock-folder-databases",
        movedBy: ALICE,
        movedByName: "Alice",
        toFolderId: "mock-folder-network",
      },
    ]);
    expect(d.folderNames).toMatchObject({
      "mock-folder-databases": "Databases",
      "mock-folder-network": "Network",
    });
  });
});
