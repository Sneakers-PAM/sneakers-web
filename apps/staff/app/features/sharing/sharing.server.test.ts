// @vitest-environment node
import { mockState } from "@sneakers-web/mock-gateway";
import {
  appRequest,
  form,
  sessionCookie,
  withMockGateway,
} from "@sneakers-web/mock-gateway/testing";

import { loadSharing, sharingAction } from "@/features/sharing/sharing.server";

withMockGateway();

const ALICE = "mock-user-alice";
const BOB = "mock-user-bob";
const DAVE = "mock-user-dave";
const DATABASES = "mock-folder-databases";
const DB_ADMIN = "mock-secret-db-admin";

const path = (kind: "folder" | "secret", id: string) => `/${kind}/${id}/sharing`;

const load = (user: string, kind: "folder" | "secret", id: string) =>
  loadSharing(appRequest(path(kind, id), { cookie: sessionCookie(user) }), kind, id);

const act = (user: string, kind: "folder" | "secret", id: string, fields: Record<string, string>) =>
  sharingAction(
    appRequest(path(kind, id), { body: form(fields), cookie: sessionCookie(user), method: "POST" }),
    kind,
    id,
  );

const status = async (p: Promise<unknown>) => {
  const thrown = await p.then(
    () => null,
    (error: unknown) => error,
  );
  return (thrown as { init?: { status?: number } } | null)?.init?.status;
};

describe("loading a folder's sharing", () => {
  it("gives an owner the editable ruleset, named, with what it inherits", async () => {
    const d = await load(ALICE, "folder", DATABASES);
    expect(d.mode).toBe("edit");
    if (d.mode === "none") throw new Error("expected a ruleset");
    expect(d.title).toBe("Platform / Databases");
    expect(d.subtitle).toBe("2 secrets · rules apply to everything inside, including subfolders");
    expect(d.backTo).toBe(`/browse/${DATABASES}`);
    expect(d.canEditEveryone).toBe(true);
    expect(d.value.owners).toEqual([ALICE]);
    expect(d.value.rules.map((r) => r.subject)).toEqual([
      { id: DAVE, kind: "user", name: "Dave" },
      { id: "mock-group-db", kind: "group", name: "DB team" },
    ]);
    expect(d.inherited.map((r) => [r.fromFolderName, r.subject.name])).toEqual([
      ["Platform", "Platform engineers"],
      ["Platform", "Everyone"],
    ]);
    expect(d.inheritedOwners).toEqual([
      {
        fromFolderId: "mock-folder-platform",
        fromFolderName: "Platform",
        name: "Carol",
        userId: "mock-user-carol",
      },
    ]);
    expect(d.subjectOptions).toEqual(
      expect.arrayContaining([{ id: "mock-group-finance", kind: "group", name: "Finance" }]),
    );
    expect(d.labels[ALICE]).toBe("Alice");
  });

  it("shows a reader who doesn't own it the ruleset, view-only", async () => {
    const d = await load(BOB, "folder", DATABASES);
    expect(d.mode).toBe("view");
    if (d.mode === "none") throw new Error("expected a ruleset");
    expect(d.canEditEveryone).toBe(false);
    expect(d.ownerNames).toEqual(["Alice", "Carol"]);
  });

  it("tells someone who can't read it no more than who owns it", async () => {
    const d = await load(DAVE, "folder", DATABASES);
    expect(d).toEqual({
      backTo: `/browse/${DATABASES}`,
      kind: "folder",
      mode: "none",
      ownerNames: ["Alice", "Carol"],
      title: "Databases",
    });
  });

  it("is a 404 for a folder that doesn't exist or is someone else's", async () => {
    expect(await status(load(ALICE, "folder", "mock-folder-nope"))).toBe(404);
    expect(await status(load(ALICE, "folder", "mock-folder-bob"))).toBe(404);
  });
});

describe("loading a secret's sharing", () => {
  it("gives a folder owner the secret's rules, with the folder chain inherited and no owners", async () => {
    const d = await load(ALICE, "secret", DB_ADMIN);
    if (d.mode === "none") throw new Error("expected a ruleset");
    expect(d.mode).toBe("edit");
    expect(d.title).toBe("DB admin");
    expect(d.subtitle).toBe("In Platform / Databases");
    expect(d.backTo).toBe(`/secret/${DB_ADMIN}`);
    expect(d.value).toEqual({
      rules: [
        { grants: { R: "deny" }, subject: { id: "mock-group-db", kind: "group", name: "DB team" } },
      ],
    });
    expect(d.inherited.map((r) => r.fromFolderName)).toEqual([
      "Databases",
      "Databases",
      "Platform",
      "Platform",
    ]);
  });

  it("is view-only for a reader, and a 404 for a secret the user can't see", async () => {
    const d = await load(BOB, "secret", DB_ADMIN);
    expect(d.mode).toBe("view");
    expect(await status(load(ALICE, "secret", "mock-secret-bob-laptop"))).toBe(404);
  });
});

describe("the sharing action", () => {
  const draft = JSON.stringify({
    owners: [ALICE, BOB],
    rules: [
      {
        grants: { A: "allow", C: "allow" },
        subject: { id: "mock-group-finance", kind: "group", name: "Finance" },
      },
    ],
  });

  it("saves a folder's draft", async () => {
    const r = await act(ALICE, "folder", DATABASES, { draft, intent: "save" });
    expect(r).toEqual({ done: "Sharing saved", intent: "save", ok: true });
    expect(mockState.world.folders.find((f) => f.id === DATABASES)?.owners).toEqual([ALICE, BOB]);
    expect(
      mockState.world.folderRules.filter((x) => x.folderId === DATABASES).map((x) => x.grants),
    ).toEqual([{ A: "allow", C: "allow" }]);
  });

  it("saves a secret's draft without owners", async () => {
    const r = await act(ALICE, "secret", DB_ADMIN, {
      draft: JSON.stringify({ rules: [] }),
      intent: "save",
    });
    expect(r.ok).toBe(true);
    expect(mockState.world.secretRules.filter((x) => x.secretId === DB_ADMIN)).toEqual([]);
  });

  it("hands a refusal back as data", async () => {
    const r = await act(BOB, "folder", DATABASES, { draft, intent: "save" });
    expect(r).toMatchObject({ intent: "save", ok: false, refusal: { reason: "NOT_FOLDER_OWNER" } });
  });

  it("refuses a draft that isn't one, before calling the gateway", async () => {
    const r = await act(ALICE, "folder", DATABASES, { draft: "{nope", intent: "save" });
    expect(r).toMatchObject({ ok: false, refusal: { code: "INVALID_ARGUMENT" } });
  });

  it("simulates a person against the unsaved draft", async () => {
    const r = await act(ALICE, "folder", DATABASES, {
      draft: JSON.stringify({
        owners: [ALICE],
        rules: [{ grants: { C: "allow" }, subject: { id: DAVE, kind: "user", name: "Dave" } }],
      }),
      intent: "simulate",
      userId: DAVE,
    });
    expect(r).toMatchObject({
      decision: { read: true, reveal: true },
      intent: "simulate",
      ok: true,
    });
  });

  it("searches people for the pickers", async () => {
    const r = await act(ALICE, "folder", DATABASES, { intent: "search", query: "bo" });
    expect(r).toEqual({
      intent: "search",
      ok: true,
      people: [{ id: BOB, kind: "user", name: "Bob" }],
    });
  });
});
