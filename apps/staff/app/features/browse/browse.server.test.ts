// @vitest-environment node
import { mockState } from "@sneakers-web/mock-gateway";
import {
  appRequest,
  form,
  sessionCookie,
  withMockGateway,
} from "@sneakers-web/mock-gateway/testing";

import { browseAction, loadBrowse } from "@/features/browse/browse.server";

withMockGateway();

const ALICE = "mock-user-alice";
const BOB = "mock-user-bob";

const load = (user: string, folderId?: string, query = "") =>
  loadBrowse(
    appRequest(`/browse${folderId ? `/${folderId}` : ""}${query}`, { cookie: sessionCookie(user) }),
    folderId,
  );

const act = (user: string, fields: Record<string, string>, folderId = "mock-folder-platform") =>
  browseAction(
    appRequest(`/browse/${folderId}`, {
      body: form(fields),
      cookie: sessionCookie(user),
      method: "POST",
    }),
    folderId,
  );

const folder = (id: string) => mockState.world.folders.find((f) => f.id === id);
const world = () => mockState.world;

describe("loading the browse page", () => {
  it("lists shared folders and the user's own personal ones, never someone else's", async () => {
    const { folders } = await load(ALICE);
    const ids = folders.map((f) => f.id);
    expect(ids).toEqual(
      expect.arrayContaining(["mock-folder-platform", "mock-folder-finance", "mock-folder-alice"]),
    );
    expect(ids).toContain("mock-folder-alice-lab");
    expect(ids).not.toContain("mock-folder-bob");
  });

  it("takes who can manage a folder from its owners, inherited down the tree", async () => {
    // Bob owns Finance and isn't a site admin, so ownership alone decides for him.
    const { folders } = await load(BOB);
    const manage = Object.fromEntries(folders.map((f) => [f.id, f.canManage]));
    expect(manage["mock-folder-finance"]).toBe(true);
    expect(manage["mock-folder-archive"]).toBe(true);
    expect(manage["mock-folder-platform"]).toBe(false);
    expect(manage["mock-folder-helpdesk"]).toBe(false);
  });

  it("lets a site admin manage every shared folder, as the vault does", async () => {
    // The vault's isFolderOwner answers yes for a human site admin or root before ownership.
    const asAlice = await load(ALICE);
    const finance = asAlice.folders.find((f) => f.id === "mock-folder-finance");
    expect(finance?.owners).not.toContain(ALICE);
    expect(finance?.canManage).toBe(true);
    const asDave = await load("mock-user-dave");
    expect(asDave.folders.find((f) => f.id === "mock-folder-finance")?.canManage).toBe(false);
  });

  it("opens a readable folder with its secrets and no field values", async () => {
    const data = await load(ALICE, "mock-folder-databases");
    expect(data.current?.folder.name).toBe("Databases");
    expect(data.current?.path).toEqual(["Platform"]);
    expect(data.current?.secrets?.map((s) => s.name)).toEqual(["DB admin", "Reporting reader"]);
    expect(data.current?.types["type-database-account"]?.name).toBe("Database Account");
    expect(data.current?.types["type-database-account"]?.fields.map((f) => f.key)).toContain(
      "password",
    );
    expect(JSON.stringify(data)).not.toContain("mock-Tongue-Eyelet-91");
  });

  it("passes on whether each secret is readable", async () => {
    const data = await load(BOB, "mock-folder-databases");
    expect(data.current?.secrets?.map((s) => [s.name, s.canRead])).toEqual([
      ["DB admin", true],
      ["Reporting reader", false],
    ]);
  });

  it("says who owns a folder the user can't read, without its secrets", async () => {
    const data = await load("mock-user-dave", "mock-folder-finance");
    expect(data.current?.access.read).toBe(false);
    expect(data.current?.folder.subtreeSecretCount).toBeNull();
    expect(data.current?.secrets).toBeNull();
    expect(data.current?.owners.map((o) => o.name)).toEqual(["Bob"]);
    expect(JSON.stringify(data)).not.toContain("Payroll");
  });

  it("answers 404 for another user's personal folder", async () => {
    await expect(load(ALICE, "mock-folder-bob")).rejects.toMatchObject({
      init: { status: 404 },
    });
  });

  it("shows retired secrets only when asked", async () => {
    const plain = await load(BOB, "mock-folder-archive");
    expect(plain.current?.secrets).toEqual([]);
    const all = await load(BOB, "mock-folder-archive", "?retired=1");
    expect(all.includeRetired).toBe(true);
    expect(all.current?.secrets?.map((s) => [s.name, s.retired])).toEqual([
      ["Legacy portal", true],
    ]);
  });
});

describe("folder changes", () => {
  it("creates a folder under one the user manages, owned by them", async () => {
    const r = await act(ALICE, {
      intent: "create",
      name: "Staging",
      parentId: "mock-folder-platform",
    });
    expect(r).toMatchObject({ ok: true });
    const made = world().folders.find((f) => f.name === "Staging");
    expect(made).toMatchObject({
      owners: [ALICE],
      parentId: "mock-folder-platform",
      scope: "group",
    });
    expect(made?.id).toMatch(/^mock-/);
  });

  it("refuses to change a folder the user doesn't own", async () => {
    const r = await act(BOB, { id: "mock-folder-platform", intent: "rename", name: "Money" });
    expect(r).toMatchObject({ ok: false, refusal: { reason: "NOT_FOLDER_OWNER" } });
    expect(folder("mock-folder-platform")?.name).toBe("Platform");
  });

  it("refuses a name a sibling already has", async () => {
    const r = await act(ALICE, { id: "mock-folder-databases", intent: "rename", name: "network" });
    expect(r).toMatchObject({ ok: false, refusal: { code: "ALREADY_EXISTS" } });
  });

  it("renames a folder", async () => {
    const r = await act(ALICE, { id: "mock-folder-databases", intent: "rename", name: "Data" });
    expect(r).toMatchObject({ ok: true });
    expect(folder("mock-folder-databases")?.name).toBe("Data");
  });

  it("moves a folder between shared folders, but never inside itself", async () => {
    const inside = await act(ALICE, {
      dest: "mock-folder-databases",
      id: "mock-folder-platform",
      intent: "move-folder",
    });
    expect(inside).toMatchObject({ ok: false, refusal: { code: "INVALID_ARGUMENT" } });
    const r = await act(ALICE, {
      dest: "mock-folder-network",
      id: "mock-folder-databases",
      intent: "move-folder",
    });
    expect(r).toMatchObject({ ok: true });
    expect(folder("mock-folder-databases")?.parentId).toBe("mock-folder-network");
  });

  it("shares a personal folder moved into a shared one", async () => {
    const r = await act(ALICE, {
      dest: "mock-folder-platform",
      id: "mock-folder-alice-lab",
      intent: "move-folder",
    });
    expect(r).toMatchObject({ ok: true });
    expect(folder("mock-folder-alice-lab")).toMatchObject({
      parentId: "mock-folder-platform",
      scope: "group",
    });
    expect(folder("mock-folder-alice-lab")?.ownerUserId).toBeUndefined();
  });

  it("makes a shared-to-personal move a request unless the user is a site admin", async () => {
    const direct = await act(BOB, {
      dest: "mock-folder-bob",
      id: "mock-folder-archive",
      intent: "move-folder",
    });
    expect(direct).toMatchObject({ ok: false, refusal: { reason: "NOT_SITE_ADMIN" } });

    const before = world().requests.length;
    const r = await act(BOB, {
      dest: "mock-folder-bob",
      destName: "Personal · My secrets",
      id: "mock-folder-archive",
      intent: "request-folder-move",
      name: "Finance / Archive",
      reason: "It only holds my old logins.",
    });
    expect(r).toMatchObject({ ok: true });
    expect(world().requests).toHaveLength(before + 1);
    expect(world().requests.at(-1)).toMatchObject({
      destParentId: "mock-folder-bob",
      folderId: "mock-folder-archive",
      kind: "folder_move",
      reason: "It only holds my old logins.",
      requestedByUserId: BOB,
      status: "pending",
    });
    expect(folder("mock-folder-archive")?.parentId).toBe("mock-folder-finance");
  });

  it("won't delete a folder that still holds secrets unless they go somewhere", async () => {
    const r = await act(ALICE, { id: "mock-folder-databases", intent: "delete" });
    expect(r).toMatchObject({ ok: false, refusal: { code: "FAILED_PRECONDITION" } });
    expect(folder("mock-folder-databases")).toBeDefined();
  });

  it("deletes a folder, moving its secrets, then opens where they went", async () => {
    const r = await act(
      ALICE,
      { id: "mock-folder-databases", intent: "delete", reassignTo: "mock-folder-platform" },
      "mock-folder-databases",
    );
    expect(r).toBeInstanceOf(Response);
    expect((r as Response).headers.get("Location")).toBe("/browse/mock-folder-platform");
    expect(folder("mock-folder-databases")).toBeUndefined();
    const moved = world().secrets.filter((s) => s.id.startsWith("mock-secret-db-"));
    expect(moved.map((s) => s.folderId)).toEqual(["mock-folder-platform", "mock-folder-platform"]);
  });

  it("deletes an empty folder outright", async () => {
    const r = await act(
      ALICE,
      { id: "mock-folder-alice-lab", intent: "delete" },
      "mock-folder-alice",
    );
    expect(r).toMatchObject({ ok: false, refusal: { code: "FAILED_PRECONDITION" } });
    world().secrets = world().secrets.filter((s) => s.folderId !== "mock-folder-alice-lab");
    const ok = await act(
      ALICE,
      { id: "mock-folder-alice-lab", intent: "delete" },
      "mock-folder-alice",
    );
    expect(ok).toMatchObject({ ok: true });
    expect(folder("mock-folder-alice-lab")).toBeUndefined();
  });

  it("reorders sibling folders", async () => {
    const r = await act(ALICE, {
      intent: "reorder",
      orderedIds: "mock-folder-certificates,mock-folder-databases,mock-folder-network",
      parentId: "mock-folder-platform",
    });
    expect(r).toMatchObject({ ok: true });
    expect(folder("mock-folder-certificates")?.order).toBe(0);
    expect(folder("mock-folder-network")?.order).toBe(2);
  });
});

describe("secret moves", () => {
  it("moves secrets between folders the user manages", async () => {
    const r = await act(
      ALICE,
      {
        dest: "mock-folder-network",
        intent: "move-secrets",
        secrets: JSON.stringify([{ id: "mock-secret-db-admin", name: "DB admin" }]),
      },
      "mock-folder-databases",
    );
    expect(r).toMatchObject({ ok: true });
    expect(world().secrets.find((s) => s.id === "mock-secret-db-admin")?.folderId).toBe(
      "mock-folder-network",
    );
  });

  it("files a request to move a shared secret into a personal folder", async () => {
    const r = await act(
      BOB,
      {
        dest: "mock-folder-bob",
        destName: "Personal · My secrets",
        intent: "request-secret-move",
        reason: "Saved here by mistake.",
        secrets: JSON.stringify([{ id: "mock-secret-payroll", name: "Payroll portal" }]),
      },
      "mock-folder-finance",
    );
    expect(r).toMatchObject({ ok: true });
    expect(world().requests.at(-1)).toMatchObject({
      destParentId: "mock-folder-bob",
      kind: "secret_move",
      requestedByUserId: BOB,
      secretId: "mock-secret-payroll",
      status: "pending",
    });
    expect(world().secrets.find((s) => s.id === "mock-secret-payroll")?.folderId).toBe(
      "mock-folder-finance",
    );
  });

  it("restores a retired secret", async () => {
    const r = await act(
      BOB,
      { id: "mock-secret-legacy-portal", intent: "restore" },
      "mock-folder-archive",
    );
    expect(r).toMatchObject({ ok: true });
    expect(world().secrets.find((s) => s.id === "mock-secret-legacy-portal")?.retired).toBe(false);
  });
});
