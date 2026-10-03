/** The statuses a dashboard tile drills into, as the gateway names them. */
export type SecretStatus = "all" | "drift" | "expired" | "expiring";

export const STATUSES: SecretStatus[] = ["all", "expiring", "expired", "drift"];

/** The `?status=` value, or "all" for anything missing or unknown. */
export const asStatus = (raw: null | string | undefined): SecretStatus =>
  STATUSES.includes(raw as SecretStatus) ? (raw as SecretStatus) : "all";

export const STATUS_TEXT: Record<
  SecretStatus,
  { empty: string; emptyTitle: string; tab: string; title: string }
> = {
  all: {
    empty: "Secrets shared with you and the ones you save show up here.",
    emptyTitle: "No secrets yet",
    tab: "All",
    title: "Accessible secrets",
  },
  drift: {
    empty: "Every secret with a target passed its last heartbeat.",
    emptyTitle: "No drift",
    tab: "Drift",
    title: "Drift",
  },
  expired: {
    empty: "Nothing you can see is past its expiry date.",
    emptyTitle: "Nothing expired",
    tab: "Expired",
    title: "Expired",
  },
  expiring: {
    empty: "Nothing you can see expires in the next 30 days.",
    emptyTitle: "Nothing expiring soon",
    tab: "Expiring",
    title: "Expiring soon",
  },
};

export const secretsByStatusPath = (status: SecretStatus): string => `/secrets?status=${status}`;
