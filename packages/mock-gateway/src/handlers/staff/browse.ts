import {
  BrowseCreateFolderDocument,
  BrowseCreateFolderMoveRequestDocument,
  BrowseCreateSecretMoveRequestDocument,
  BrowseDeleteFolderDocument,
  BrowseFolderAccessDocument,
  type BrowseFolderFieldsFragment,
  BrowseFoldersDocument,
  BrowseMoveFolderDocument,
  BrowseMoveSecretDocument,
  BrowseRenameFolderDocument,
  BrowseReorderFoldersDocument,
  BrowseRestoreSecretDocument,
  BrowseSecretsDocument,
} from "@sneakers-web/api-client";
import { HttpResponse } from "msw";

import type { MockFolder, MockRequest, MockSecret } from "#mock/fixtures/world";

import { groupsOf } from "#mock/admin/directory";
import { isSiteAdmin, refusal } from "#mock/admin/refuse";
import { userById } from "#mock/fixtures/users";
import { api, asUser } from "#mock/handlers/graphql";
import { mockState, newToken } from "#mock/state";

/*
 * Mock answers for folder browsing and folder changes (S2), checked the way the vault checks
 * them: a user sees every shared folder and only their own personal ones; owners (of the folder
 * or any folder above it) manage it; reading needs ownership, the folder's group or its role.
 */

const ok = <T>(data: T) => HttpResponse.json({ data }) as never;

const notFound = () => refusal("NOT_FOUND", "folder not found");
const notOwner = () =>
  refusal("PERMISSION_DENIED", "only a folder owner can do that", "NOT_FOLDER_OWNER");
const notAdmin = () => refusal("PERMISSION_DENIED", "site admin required", "NOT_SITE_ADMIN");
const invalid = (desc: string) => refusal("INVALID_ARGUMENT", desc);
const precondition = (desc: string) => refusal("FAILED_PRECONDITION", desc);

const folders = () => mockState.world.folders;
const byId = (id: null | string | undefined) =>
  id ? folders().find((f) => f.id === id) : undefined;

/** The folder and every folder above it, nearest first. */
const chain = (folder: MockFolder): MockFolder[] => {
  const out: MockFolder[] = [];
  for (let f: MockFolder | undefined = folder; f; f = byId(f.parentId)) out.push(f);
  return out;
};

/** The folder's id and every folder below it. */
const subtree = (id: string): Set<string> => {
  const ids = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const f of folders()) {
      if (f.parentId && ids.has(f.parentId) && !ids.has(f.id)) {
        ids.add(f.id);
        grew = true;
      }
    }
  }
  return ids;
};

const visible = (userId: string, f: MockFolder) =>
  f.scope !== "personal" || f.ownerUserId === userId;

const ownsChain = (userId: string, f: MockFolder) =>
  chain(f).some((c) => c.owners.includes(userId));

/** As the vault's isFolderOwner: a site admin or root manages every folder, owners their own. */
const canManage = (userId: string, f: MockFolder) => isSiteAdmin(userId) || ownsChain(userId, f);

const canRead = (userId: string, f: MockFolder): boolean => {
  if (f.scope === "personal") return f.ownerUserId === userId;
  if (ownsChain(userId, f)) return true;
  const groups = new Set(groupsOf(userId).map((g) => g.id));
  const roles = new Set(userById(userId)?.roles);
  return chain(f).some(
    (c) => (c.groupId && groups.has(c.groupId)) || (c.role && roles.has(c.role)),
  );
};

/** The personal owner of the nearest personal folder at or above `f`, if there is one. */
const personalOwner = (f: MockFolder | undefined): string | undefined =>
  f ? chain(f).find((c) => c.scope === "personal")?.ownerUserId : undefined;

const live = (s: MockSecret) => !s.retired;

const toFolder = (userId: string, f: MockFolder): BrowseFolderFieldsFragment => {
  const ids = subtree(f.id);
  return {
    canManage: canManage(userId, f),
    groupId: f.groupId ?? null,
    id: f.id,
    isMasterPersonal: f.isMasterPersonal ?? false,
    name: f.name,
    order: f.order,
    owners: f.owners,
    ownerUserId: f.ownerUserId ?? null,
    parentId: f.parentId ?? null,
    role: f.role ?? null,
    scope: f.scope,
    subtreeSecretCount: canRead(userId, f)
      ? mockState.world.secrets.filter((s) => ids.has(s.folderId)).length
      : null,
  };
};

/** The folder `id` as `userId` may see it, or undefined (unknown, or someone else's). */
const seen = (userId: string, id: null | string | undefined) => {
  const f = byId(id);
  return f && visible(userId, f) ? f : undefined;
};

/** Move `f` (and everything below it) under `parent`, taking on the parent's scope. */
const reparent = (f: MockFolder, parent: MockFolder | undefined) => {
  f.parentId = parent?.id;
  f.order = folders().filter((s) => s.parentId === parent?.id && s.id !== f.id).length;
  if (!parent) return;
  for (const id of subtree(f.id)) {
    const d = byId(id) as MockFolder;
    d.scope = parent.scope;
    d.ownerUserId = parent.ownerUserId;
  }
};

const siblingNamed = (parentId: string | undefined, name: string, except?: string) =>
  folders().some(
    (f) =>
      f.parentId === parentId && f.id !== except && f.name.toLowerCase() === name.toLowerCase(),
  );

const request = (fields: Partial<MockRequest> & Pick<MockRequest, "kind">): MockRequest => ({
  comments: [],
  destParentId: "",
  destParentName: "",
  folderId: "",
  folderName: "",
  id: newToken("mock-req"),
  requestedAt: new Date().toISOString(),
  requestedByUserId: "",
  secretId: "",
  status: "pending",
  ...fields,
});

const answer = (r: MockRequest) => ({ id: r.id, kind: r.kind, status: r.status });

export const browseHandlers = [
  api.query(BrowseFoldersDocument, ({ request: request_ }) =>
    asUser(request_, (userId) =>
      ok({
        folders: folders()
          .filter((f) => visible(userId, f))
          .map((f) => toFolder(userId, f)),
      }),
    ),
  ),

  api.query(BrowseFolderAccessDocument, ({ request: request_, variables }) =>
    asUser(request_, (userId) => {
      const f = seen(userId, variables.folderId);
      if (!f) return notFound();
      const read = canRead(userId, f);
      const manage = canManage(userId, f);
      return ok({
        myFolderAccess: {
          approve: manage,
          informed: true,
          manage,
          manageRuleset: manage,
          read,
          reveal: read,
        },
        resolveUserLabels: [variables.ownerIds]
          .flat()
          .map((id) => ({ id, name: userById(id)?.name ?? id })),
      });
    }),
  ),

  api.query(BrowseSecretsDocument, ({ request: request_, variables }) =>
    asUser(request_, (userId) => {
      const f = seen(userId, variables.folderId);
      if (!f) return notFound();
      if (!canRead(userId, f)) {
        return refusal("PERMISSION_DENIED", "no read access to this folder", "NO_ACCESS");
      }
      return ok({
        secretsInFolder: mockState.world.secrets
          .filter((s) => s.folderId === f.id && (variables.includeRetired || live(s)))
          .map((s) => ({
            canRead: s.canRead,
            folderId: s.folderId,
            id: s.id,
            lastHeartbeatResult: s.lastHeartbeatResult ?? null,
            name: s.name,
            retired: s.retired,
            retiredAt: s.retiredAt,
            targetId: s.targetId ?? null,
            typeId: s.typeId,
          })),
        secretTypes: mockState.world.secretTypes.map(({ id, name }) => ({ id, name })),
      });
    }),
  ),

  api.mutation(BrowseCreateFolderDocument, ({ request: request_, variables }) =>
    asUser(request_, (userId) => {
      const name = variables.name.trim();
      if (!name) return invalid("name is required");
      const parent = variables.parentId ? seen(userId, variables.parentId) : undefined;
      if (variables.parentId && !parent) return notFound();
      if (parent ? !canManage(userId, parent) : !isSiteAdmin(userId)) {
        return parent ? notOwner() : notAdmin();
      }
      if (siblingNamed(parent?.id, name)) {
        return refusal("ALREADY_EXISTS", "a folder with that name already exists here");
      }
      const made: MockFolder = {
        groupId: parent ? undefined : newToken("mock-group"),
        id: newToken("mock-folder"),
        name,
        order: folders().filter((f) => f.parentId === parent?.id).length,
        owners: [userId],
        ownerUserId: parent?.ownerUserId,
        parentId: parent?.id,
        role: parent?.role,
        scope: parent?.scope ?? "group",
      };
      folders().push(made);
      return ok({ createFolder: toFolder(userId, made) });
    }),
  ),

  api.mutation(BrowseRenameFolderDocument, ({ request: request_, variables }) =>
    asUser(request_, (userId) => {
      const f = seen(userId, variables.id);
      if (!f) return notFound();
      if (!canManage(userId, f)) return notOwner();
      const name = variables.name.trim();
      if (!name) return invalid("name is required");
      if (siblingNamed(f.parentId, name, f.id)) {
        return refusal("ALREADY_EXISTS", "a folder with that name already exists here");
      }
      f.name = name;
      return ok({ renameFolder: { id: f.id, name: f.name } });
    }),
  ),

  api.mutation(BrowseMoveFolderDocument, ({ request: request_, variables }) =>
    asUser(request_, (userId) => {
      const f = seen(userId, variables.id);
      if (!f) return notFound();
      if (!canManage(userId, f)) return notOwner();
      if (f.isMasterPersonal) return precondition("a personal root folder can't be moved");
      const destination = variables.newParentId ? seen(userId, variables.newParentId) : undefined;
      if (variables.newParentId && !destination) return notFound();
      if (destination && subtree(f.id).has(destination.id)) {
        return invalid("a folder can't move inside itself");
      }
      if (destination ? !canManage(userId, destination) : !isSiteAdmin(userId)) {
        return destination ? notOwner() : notAdmin();
      }
      const destinationOwner = personalOwner(destination);
      const alreadyTheirs = f.scope === "personal" && f.ownerUserId === destinationOwner;
      if (destinationOwner && !alreadyTheirs && !isSiteAdmin(userId)) return notAdmin();
      reparent(f, destination);
      return ok({ moveFolder: { id: f.id, parentId: f.parentId ?? null, scope: f.scope } });
    }),
  ),

  api.mutation(BrowseDeleteFolderDocument, ({ request: request_, variables }) =>
    asUser(request_, (userId) => {
      const f = seen(userId, variables.id);
      if (!f) return notFound();
      if (!canManage(userId, f)) return notOwner();
      if (f.isMasterPersonal) return precondition("a personal root folder can't be deleted");
      const below = subtree(f.id);
      const world = mockState.world;
      if (!variables.reassignToId) {
        if (world.secrets.some((s) => below.has(s.folderId))) {
          return precondition("the folder still holds secrets; pick a folder to move them to");
        }
        world.folders = world.folders.filter((x) => !below.has(x.id));
        return ok({ deleteFolder: true });
      }
      const to = seen(userId, variables.reassignToId);
      if (!to) return notFound();
      if (below.has(to.id)) return invalid("the contents can't move into the folder being deleted");
      if (!canManage(userId, to)) return notOwner();
      if ((to.scope === "personal") !== (f.scope === "personal")) {
        return invalid("personal and shared contents can't mix");
      }
      for (const child of world.folders.filter((x) => x.parentId === f.id)) reparent(child, to);
      for (const s of world.secrets) if (s.folderId === f.id) s.folderId = to.id;
      world.folders = world.folders.filter((x) => x.id !== f.id);
      return ok({ deleteFolder: true });
    }),
  ),

  api.mutation(BrowseReorderFoldersDocument, ({ request: request_, variables }) =>
    asUser(request_, (userId) => {
      const parent = variables.parentId ? seen(userId, variables.parentId) : undefined;
      if (variables.parentId && !parent) return notFound();
      if (parent ? !canManage(userId, parent) : !isSiteAdmin(userId)) {
        return parent ? notOwner() : notAdmin();
      }
      const siblings = folders().filter((f) => f.parentId === parent?.id && visible(userId, f));
      const known = new Set(siblings.map((f) => f.id));
      const ordered = [variables.orderedIds].flat();
      if (ordered.some((id) => !known.has(id))) {
        return invalid("every folder must be a child of the parent");
      }
      for (const [index, id] of ordered.entries()) (byId(id) as MockFolder).order = index;
      return ok({ reorderFolders: true });
    }),
  ),

  api.mutation(BrowseCreateFolderMoveRequestDocument, ({ request: request_, variables }) =>
    asUser(request_, (userId) => {
      const f = seen(userId, variables.folderId);
      const destination = seen(userId, variables.destParentId);
      if (!f || !destination) return notFound();
      if (!canManage(userId, f)) return notOwner();
      if (!personalOwner(destination))
        return invalid("a move request is only for a personal folder");
      if (subtree(f.id).has(destination.id)) return invalid("a folder can't move inside itself");
      const r = request({
        destParentId: destination.id,
        destParentName: variables.destParentName ?? destination.name,
        folderId: f.id,
        folderName: variables.folderName ?? f.name,
        kind: "folder_move",
        reason: variables.reason ?? undefined,
        requestedByUserId: userId,
      });
      mockState.world.requests.push(r);
      return ok({ createFolderMoveRequest: answer(r) });
    }),
  ),

  api.mutation(BrowseCreateSecretMoveRequestDocument, ({ request: request_, variables }) =>
    asUser(request_, (userId) => {
      const s = mockState.world.secrets.find((x) => x.id === variables.secretId);
      const from = seen(userId, s?.folderId);
      const destination = seen(userId, variables.destFolderId);
      if (!s || !from || !destination || !canRead(userId, from)) return notFound();
      if (!personalOwner(destination))
        return invalid("a move request is only for a personal folder");
      const r = request({
        destParentId: destination.id,
        destParentName: variables.destFolderName ?? destination.name,
        folderId: from.id,
        folderName: variables.secretName ?? s.name,
        kind: "secret_move",
        reason: variables.reason ?? undefined,
        requestedByUserId: userId,
        secretId: s.id,
      });
      mockState.world.requests.push(r);
      return ok({ createSecretMoveRequest: answer(r) });
    }),
  ),

  api.mutation(BrowseMoveSecretDocument, ({ request: request_, variables }) =>
    asUser(request_, (userId) => {
      const s = mockState.world.secrets.find((x) => x.id === variables.id);
      const from = seen(userId, s?.folderId);
      const destination = seen(userId, variables.folderId);
      if (!s || !from || !destination || !canRead(userId, from)) return notFound();
      if (!canManage(userId, from) || !canManage(userId, destination)) return notOwner();
      const destinationOwner = personalOwner(destination);
      if (destinationOwner && personalOwner(from) !== destinationOwner && !isSiteAdmin(userId))
        return notAdmin();
      s.folderId = destination.id;
      return ok({ updateSecret: { folderId: s.folderId, id: s.id } });
    }),
  ),

  api.mutation(BrowseRestoreSecretDocument, ({ request: request_, variables }) =>
    asUser(request_, (userId) => {
      const s = mockState.world.secrets.find((x) => x.id === variables.id);
      const from = seen(userId, s?.folderId);
      if (!s || !from || !canRead(userId, from)) return notFound();
      if (!canManage(userId, from)) return notOwner();
      s.retired = false;
      s.retiredAt = "";
      return ok({ restoreSecret: { id: s.id, retired: false } });
    }),
  ),
];
