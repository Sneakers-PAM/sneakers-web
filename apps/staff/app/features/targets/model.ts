import type { Refusal } from "@sneakers-web/shell";

export interface ConnectionChoice {
  label: string;
  protocol: string;
  value: string;
}

/** One of a target's connections, as the editor holds it: the connection it binds to, and
 * whether it's the one a session starts on. */
export interface ConnectionEntry {
  connectionId: string;
  isDefault: boolean;
}

/** What the target editor (U-11) holds while someone types. */
export interface TargetDraft {
  connections: ConnectionEntry[];
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
  connections: [],
  description: "",
  domain: "",
  hostname: "",
  kind: "",
  name: "",
  realm: "",
};

/**
 * What's wrong with the editor's connection list, or undefined when it's fine: at least one
 * connection, no two sharing a protocol, and exactly one marked default. Mirrors the vault's own
 * validation, so a problem shows in the editor instead of coming back as a refusal.
 */
export const connectionsProblem = (
  connections: ConnectionEntry[],
  choices: ConnectionChoice[],
): string | undefined => {
  if (connections.length === 0) return "Add at least one connection.";
  const protocolOf = new Map(choices.map((c) => [c.value, c.protocol]));
  const protocols = connections.map((c) => protocolOf.get(c.connectionId));
  if (new Set(protocols).size !== protocols.length)
    return "Each connection needs a different protocol.";
  if (connections.filter((c) => c.isDefault).length !== 1)
    return "Pick exactly one connection as the default.";
  return undefined;
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
