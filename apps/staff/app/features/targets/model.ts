import type { Refusal } from "@sneakers-web/shell";

export interface ConnectionChoice {
  label: string;
  value: string;
}

/** What the target editor (U-11) holds while someone types. */
export interface TargetDraft {
  connectionId: string;
  description: string;
  domain: string;
  hostname: string;
  kind: string;
  name: string;
  realm: string;
}

/** A row of the targets list (U-10). */
export interface TargetRow {
  /** The owner, or a site admin: may edit and delete it. */
  canManage: boolean;
  connection: null | string;
  hostname: string;
  id: string;
  name: string;
  scope: "personal" | "shared";
  secretCount: number;
}

/** The /targets form result: done, in use (the vault answers false), or refused. */
export type TargetsResult =
  | { done: string; intent: string; ok: true }
  | { intent: string; inUse: boolean; ok: false; refusal: null | Refusal };

export const EMPTY_DRAFT: TargetDraft = {
  connectionId: "",
  description: "",
  domain: "",
  hostname: "",
  kind: "",
  name: "",
  realm: "",
};

/**
 * The connector kinds the editor offers. The connector doesn't read the kind (the connection's
 * protocol picks the adapter); it tells people what the host is, and a directory domain is
 * what the domain and realm fields are for.
 */
export const KINDS = [
  { label: "None", value: "" },
  { label: "Windows host", value: "windows" },
  { label: "Directory domain", value: "active-directory" },
] as const;
