export interface FolderNode {
  id: string;
  name: string;
  parentId: null | string;
}

/** "Platform / Databases": a folder's name under its ancestors, as far up as the caller can see. */
export const folderPaths = (folders: FolderNode[]): ((id: string) => string) => {
  const byId = new Map(folders.map((f) => [f.id, f]));
  return (id) => {
    const names: string[] = [];
    const seen = new Set<string>();
    let at = byId.get(id);
    while (at && !seen.has(at.id)) {
      seen.add(at.id);
      names.unshift(at.name);
      at = at.parentId ? byId.get(at.parentId) : undefined;
    }
    return names.join(" / ");
  };
};
