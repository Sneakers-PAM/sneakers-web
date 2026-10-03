import { childrenOf, type NavFolder } from "@/features/browse/tree";

export type FolderAction = "create" | "delete" | "down" | "move" | "rename" | "sharing" | "up";

export interface FolderActionItem {
  action: FolderAction;
  label: string;
  /** Draw a separator above this item. */
  split?: boolean;
  tone?: "danger";
}

/** The folder menu (header and right-click): changes only for people who manage the folder. */
export const folderActions = (folders: NavFolder[], folder: NavFolder): FolderActionItem[] => {
  if (!folder.canManage) return [{ action: "sharing", label: "Manage access" }];
  const siblings = childrenOf(folders, folder.parentId ?? null);
  const at = siblings.findIndex((s) => s.id === folder.id);
  const root = folder.isMasterPersonal === true;
  const items: (false | FolderActionItem)[] = [
    { action: "create", label: "New folder…" },
    { action: "rename", label: "Rename…" },
    !root && { action: "move", label: "Move…" },
    at > 0 && { action: "up", label: "Move up" },
    at >= 0 && at < siblings.length - 1 && { action: "down", label: "Move down" },
    { action: "sharing", label: "Manage access", split: true },
    !root && { action: "delete", label: "Delete…", split: true, tone: "danger" },
  ];
  return items.filter((index): index is FolderActionItem => index !== false);
};
