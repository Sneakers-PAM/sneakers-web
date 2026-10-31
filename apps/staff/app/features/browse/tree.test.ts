import type { NavFolder } from "@/features/browse/tree";

import {
  activeFolderId,
  creatableFolders,
  folderDestinations,
  reassignTargets,
  secretDestinations,
} from "@/features/browse/tree";

const folder = (id: string, name: string, canManage: boolean, parentId: null | string = null) =>
  ({
    canManage,
    groupId: null,
    id,
    isMasterPersonal: null,
    name,
    order: null,
    owners: null,
    ownerUserId: null,
    parentId,
    role: null,
    scope: "group",
    subtreeSecretCount: null,
  }) as NavFolder;

describe("resolving the sidebar's active folder", () => {
  it("uses the /browse/:folderId param directly", () => {
    expect(activeFolderId("mock-folder-platform", [])).toBe("mock-folder-platform");
  });

  it("falls back to the secret's containing folder on /secret/:id, which has no folder param", () => {
    const matches = [
      { data: undefined, id: "routes/frame" },
      {
        data: {
          folderPath: [
            { id: "mock-folder-platform", name: "Platform" },
            { id: "mock-folder-databases", name: "Databases" },
          ],
          ok: true,
        },
        id: "routes/secret",
      },
    ];
    expect(activeFolderId(undefined, matches)).toBe("mock-folder-databases");
  });

  it("resolves a personal folder the same way", () => {
    const matches = [
      {
        data: { folderPath: [{ id: "mock-folder-alice-personal", name: "My secrets" }], ok: true },
        id: "routes/secret",
      },
    ];
    expect(activeFolderId(undefined, matches)).toBe("mock-folder-alice-personal");
  });

  it("stays unhighlighted when the secret page failed to load", () => {
    const matches = [{ data: { ok: false }, id: "routes/secret" }];
    expect(activeFolderId(undefined, matches)).toBeUndefined();
  });

  it("stays unhighlighted off both routes", () => {
    expect(activeFolderId(undefined, [])).toBeUndefined();
  });
});

describe("where a new folder can be created", () => {
  it("lists only the folders the user manages, nothing marked self", () => {
    const folders = [
      folder("f-platform", "Platform", true),
      folder("f-databases", "Databases", true, "f-platform"),
      folder("f-archive", "Archive", false),
    ];
    const destinations = creatableFolders(folders);
    expect(destinations.map((d) => d.folder.id)).toEqual(["f-platform", "f-databases"]);
    expect(destinations.every((d) => !d.self)).toBe(true);
  });
});

describe("the personal folder root", () => {
  const personal = (id: string, name: string, parentId: null | string = null) =>
    ({
      ...folder(id, name, true, parentId),
      isMasterPersonal: parentId === null,
      scope: "personal",
    }) as NavFolder;
  const folders = [
    personal("p-root", "My secrets"),
    personal("p-lab", "Lab", "p-root"),
    personal("p-keys", "Keys", "p-root"),
    folder("f-platform", "Platform", true),
  ];
  const ids = (destinations: { folder: NavFolder }[]) => destinations.map((d) => d.folder.id);
  const platform = folders[3] as NavFolder;
  const lab = folders[1] as NavFolder;

  it("isn't a place to move a secret, though the folders inside it are", () => {
    expect(ids(secretDestinations(folders, platform))).toEqual(["p-keys", "p-lab", "f-platform"]);
  });

  it("isn't a place for a deleted folder's secrets to go", () => {
    expect(ids(reassignTargets(folders, lab))).toEqual(["p-keys"]);
  });

  it("still takes folders", () => {
    expect(ids(folderDestinations(folders, lab))).toContain("p-root");
    expect(ids(creatableFolders(folders))).toContain("p-root");
  });
});
