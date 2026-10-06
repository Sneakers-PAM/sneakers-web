import type { BrowseFolderAccessQuery, BrowseSecretsQuery } from "@sneakers-web/api-client";
import type { Refusal } from "@sneakers-web/shell";

import type { NavFolder } from "@/features/browse/tree";

export interface BrowseData {
  current: null | OpenFolder;
  folders: NavFolder[];
  includeRetired: boolean;
  isAdmin: boolean;
  userId: string;
}

export type BrowseResult =
  { done: string; intent: string; ok: true } | { intent: string; ok: false; refusal: Refusal };

export type BrowseSecret = BrowseSecretsQuery["secretsInFolder"][number];

export type BrowseSecretType = BrowseSecretsQuery["secretTypes"][number];

export interface OpenFolder {
  access: BrowseFolderAccessQuery["myFolderAccess"];
  folder: NavFolder;
  owners: { id: string; name: string }[];
  /** Names of the folders above, root first. */
  path: string[];
  /** Null when the user can see the folder exists but can't read it. */
  secrets: BrowseSecret[] | null;
  types: Record<string, BrowseSecretType>;
}
