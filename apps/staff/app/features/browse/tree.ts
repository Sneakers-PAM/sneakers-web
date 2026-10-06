import type { BrowseFolderFieldsFragment } from "@sneakers-web/api-client";

export type NavFolder = BrowseFolderFieldsFragment;

/** The pick that stands for "no parent": a shared folder at the top level. */
export const TOP_LEVEL = "top-level";

export interface Destination {
  folder: NavFolder;
  label: string;
  /** The folder being moved: listed so people see where it is, never pickable. */
  self: boolean;
}

/** How a move goes: straight away, after a "this shares it" confirm, or as an approval request. */
export type MoveKind = "direct" | "request" | "share";

const byOrder = (a: NavFolder, b: NavFolder) =>
  (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name);

export const childrenOf = (folders: NavFolder[], parentId: null | string): NavFolder[] =>
  folders.filter((f) => (f.parentId ?? null) === parentId).toSorted(byOrder);

export const findFolder = (folders: NavFolder[], id: null | string | undefined) =>
  id ? folders.find((f) => f.id === id) : undefined;

/** A `useMatches()` entry, trimmed to what `activeFolderId` reads. */
export interface RouteMatch {
  data: unknown;
  id: string;
}

/** The id of `routes/secret.tsx`, registered at `secret/:id` in routes.ts. */
const SECRET_ROUTE_ID = "routes/secret";

/**
 * The folder the sidebar should highlight: the `/browse/:folderId` param directly, or - on
 * `/secret/:id`, which has no folder param of its own - the secret's containing folder, the last
 * entry of the `folderPath` its own route already loaded (read here via `useMatches` so the
 * sidebar, which sits above both routes, never needs a fetch of its own).
 */
export const activeFolderId = (
  folderIdParameter: string | undefined,
  matches: RouteMatch[],
): string | undefined => {
  if (folderIdParameter) return folderIdParameter;
  const secretData = matches.find((m) => m.id === SECRET_ROUTE_ID)?.data as
    { folderPath?: { id: string }[]; ok?: boolean } | undefined;
  return secretData?.ok ? secretData.folderPath?.at(-1)?.id : undefined;
};

/** The folder and its ancestors, root first. */
export const lineage = (folders: NavFolder[], folder: NavFolder): NavFolder[] => {
  const out: NavFolder[] = [];
  for (let f: NavFolder | undefined = folder; f; f = findFolder(folders, f.parentId)) {
    out.unshift(f);
  }
  return out;
};

export const isPersonal = (f: NavFolder) => f.scope === "personal";

/** "Platform / Databases", or "Personal · My secrets / Lab" for a personal folder. */
export const folderLabel = (folders: NavFolder[], folder: NavFolder): string => {
  const path = lineage(folders, folder)
    .map((f) => f.name)
    .join(" / ");
  return isPersonal(folder) ? `Personal · ${path}` : path;
};

export const subtreeIds = (folders: NavFolder[], id: string): Set<string> => {
  const ids = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const f of folders) {
      if (f.parentId && ids.has(f.parentId) && !ids.has(f.id)) {
        ids.add(f.id);
        grew = true;
      }
    }
  }
  return ids;
};

/** Every folder in tree order (personal first), depth first. */
export const treeOrder = (folders: NavFolder[]): NavFolder[] => {
  const out: NavFolder[] = [];
  const walk = (parentId: null | string) => {
    for (const f of childrenOf(folders, parentId)) {
      out.push(f);
      walk(f.id);
    }
  };
  walk(null);
  return out.toSorted((a, b) => Number(isPersonal(b)) - Number(isPersonal(a)));
};

/**
 * Where a folder can move: folders the user manages, never inside itself. The folder itself
 * stays in the list, marked, so the picker shows where it sits now.
 */
export const folderDestinations = (folders: NavFolder[], source: NavFolder): Destination[] => {
  const below = subtreeIds(folders, source.id);
  return treeOrder(folders)
    .filter((f) => f.canManage && (f.id === source.id || !below.has(f.id)))
    .map((f) => ({ folder: f, label: folderLabel(folders, f), self: f.id === source.id }));
};

/** Where secrets can move from `from`: any other folder the user manages. */
export const secretDestinations = (folders: NavFolder[], from: NavFolder): Destination[] =>
  treeOrder(folders)
    .filter((f) => f.canManage)
    .map((f) => ({ folder: f, label: folderLabel(folders, f), self: f.id === from.id }));

/** Where a deleted folder's contents can go: same realm, outside the folder, managed. */
export const reassignTargets = (folders: NavFolder[], folder: NavFolder): Destination[] => {
  const below = subtreeIds(folders, folder.id);
  return treeOrder(folders)
    .filter((f) => f.canManage && !below.has(f.id) && isPersonal(f) === isPersonal(folder))
    .map((f) => ({ folder: f, label: folderLabel(folders, f), self: false }));
};

/**
 * The way the vault gates a move: into a personal folder that isn't already the mover's own
 * needs a site admin's approval (a site admin moves straight away); out of a personal folder
 * into a shared one shares it, so it's confirmed first.
 */
export const moveKind = (
  folders: NavFolder[],
  from: NavFolder,
  to: NavFolder | undefined,
  isAdmin: boolean,
): MoveKind => {
  const owner = (f: NavFolder | undefined) =>
    f ? lineage(folders, f).find((x) => isPersonal(x))?.ownerUserId : undefined;
  const destinationOwner = owner(to);
  if (destinationOwner) return owner(from) === destinationOwner || isAdmin ? "direct" : "request";
  return isPersonal(from) ? "share" : "direct";
};

/** Sibling ids after moving `id` one place up or down, for reorderFolders. */
export const reordered = (
  folders: NavFolder[],
  id: string,
  direction: "down" | "up",
): null | string[] => {
  const f = findFolder(folders, id);
  if (!f) return null;
  const ids = childrenOf(folders, f.parentId ?? null).map((s) => s.id);
  const at = ids.indexOf(id);
  const to = direction === "up" ? at - 1 : at + 1;
  if (to < 0 || to >= ids.length) return null;
  [ids[at], ids[to]] = [ids[to] as string, ids[at] as string];
  return ids;
};
