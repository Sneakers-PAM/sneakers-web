import type { NavFolder } from "@/features/browse/tree";

import { activeFolderId, creatableFolders } from "@/features/browse/tree";

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
