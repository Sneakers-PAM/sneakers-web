import type { GatewayClient } from "@sneakers-web/api-client";

import { AdminAuditDocument } from "@sneakers-web/api-client";

/** The filters on the audit page, as they sit in its URL. */
export interface AuditFilters {
  actor: string;
  from: string;
  hide: string[];
  show: "100" | "25" | "50" | "all";
  subject: string;
  to: string;
  when: "24h" | "30d" | "7d" | "all" | "custom";
}

const SHOWS = new Set(["25", "50", "100", "all"]);
const WHENS = new Set(["24h", "7d", "30d", "all", "custom"]);

/**
 * The API filters by actor, subject and hidden actions, not by time. With a date range the
 * page reads up to this many of the newest records and keeps the ones inside it.
 */
export const DATE_WINDOW_CAP = 2000;

export const filtersFrom = (url: URL): AuditFilters => {
  const p = url.searchParams;
  const show = p.get("show") ?? "25";
  const when = p.get("when") ?? "all";
  return {
    actor: p.get("actor")?.trim() ?? "",
    from: p.get("from") ?? "",
    hide: p.getAll("hide").filter(Boolean),
    show: (SHOWS.has(show) ? show : "25") as AuditFilters["show"],
    subject: p.get("subject")?.trim() ?? "",
    to: p.get("to") ?? "",
    when: (WHENS.has(when) ? when : "all") as AuditFilters["when"],
  };
};

const HOUR = 3_600_000;

/** The time range a filter set covers, in milliseconds, or null for all time. */
const rangeOf = (f: AuditFilters, now: number): [number, number] | null => {
  if (f.when === "24h") return [now - 24 * HOUR, now];
  if (f.when === "7d") return [now - 7 * 24 * HOUR, now];
  if (f.when === "30d") return [now - 30 * 24 * HOUR, now];
  if (f.when === "custom") {
    const from = f.from ? new Date(`${f.from}T00:00:00Z`).getTime() : 0;
    const to = f.to ? new Date(`${f.to}T23:59:59Z`).getTime() : now;
    return [Number.isNaN(from) ? 0 : from, Number.isNaN(to) ? now : to];
  }
  return null;
};

/** Read the trail with the page's filters: the newest first, at most `show` records. */
export const readAudit = async (gw: GatewayClient, f: AuditFilters, now = Date.now()) => {
  const limit = f.show === "all" ? 0 : Number(f.show);
  const range = rangeOf(f, now);
  // The actor box takes a name, a username or an id; the API wants the id.
  let actorUserId: null | string = null;
  if (f.actor) {
    const needle = f.actor.toLowerCase();
    const { users } = await gw.gql(AdminAuditDocument, { limit: 1 });
    actorUserId =
      users.find((u) => u.name.toLowerCase() === needle || u.username.toLowerCase() === needle)
        ?.id ?? f.actor;
  }
  const d = await gw.gql(AdminAuditDocument, {
    actorUserId,
    excludeActions: f.hide.length > 0 ? f.hide : null,
    limit: range ? DATE_WINDOW_CAP : limit || null,
    subject: f.subject || null,
  });
  let records = d.auditRecords;
  if (range) {
    records = records.filter((r) => {
      const t = new Date(r.occurredAt).getTime();
      return t >= range[0] && t <= range[1];
    });
    if (limit) records = records.slice(0, limit);
  }
  return {
    actions: d.auditActions,
    capped: !!range && d.auditRecords.length >= DATE_WINDOW_CAP,
    chain: d.auditChain,
    groups: d.groups,
    records,
  };
};
