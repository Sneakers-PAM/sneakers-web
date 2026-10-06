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

/** A kind set elsewhere (the admin console's free-text list) shows capitalized, not raw. */
export const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const IPV4_OCTET = String.raw`(25[0-5]|2[0-4]\d|1?\d{1,2})`;
const IPV4_RE = new RegExp(String.raw`^${IPV4_OCTET}(\.${IPV4_OCTET}){3}$`);
// Loose on purpose: enough to tell an IPv6 literal from a hostname, not a full RFC 5952 check.
const IPV6_RE = /^([\da-f]{0,4}:){2,7}[\da-f]{0,4}$/i;
const HOSTNAME_RE = /^(?=.{1,253}$)(?!-)[a-zA-Z\d-]{1,63}(?<!-)(\.(?!-)[a-zA-Z\d-]{1,63}(?<!-))*$/;

/** What the host field's value looks like, for labelling and validation. */
export type HostKind = "fqdn" | "invalid" | "ipv4" | "ipv6";

export const hostKindOf = (value: string): HostKind => {
  const v = value.trim();
  if (v.includes(":")) return IPV6_RE.test(v) ? "ipv6" : "invalid";
  if (IPV4_RE.test(v)) return "ipv4";
  return HOSTNAME_RE.test(v) ? "fqdn" : "invalid";
};
