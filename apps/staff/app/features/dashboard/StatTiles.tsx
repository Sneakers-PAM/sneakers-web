import type { ReactNode } from "react";

import { cn } from "@sneakers-web/ui";
import { Clock, Heart, LayoutGrid, X } from "lucide-react";
import { Link } from "react-router";

import { secretsByStatusPath, type SecretStatus } from "@/features/dashboard/status";

export interface Stats {
  drift: number;
  expired: number;
  expiringSoon: number;
  total: number;
}

interface Tile {
  hint: string;
  icon: ReactNode;
  label: string;
  status: SecretStatus;
  /** How the tile looks once the count is above zero. */
  tone: "danger" | "neutral" | "warn";
  value: number;
}

const tiles = (s: Stats): Tile[] => [
  {
    hint: "secrets you can see",
    icon: <LayoutGrid aria-hidden className="text-muted" />,
    label: "Accessible",
    status: "all",
    tone: "neutral",
    value: s.total,
  },
  {
    hint: "within 30 days",
    icon: <Clock aria-hidden className="text-muted" />,
    label: "Expiring soon",
    status: "expiring",
    tone: "neutral",
    value: s.expiringSoon,
  },
  {
    hint: "past due",
    icon: <X aria-hidden className="text-danger" strokeWidth={3} />,
    label: "Expired",
    status: "expired",
    tone: "danger",
    value: s.expired,
  },
  {
    hint: "failed heartbeat",
    icon: <Heart aria-hidden className="text-warn" fill="currentColor" />,
    label: "Drift",
    status: "drift",
    tone: "warn",
    value: s.drift,
  },
];

/** The four counts over the secrets the user can read; each opens its list. */
export const StatTiles = ({ stats }: { stats: Stats }) => {
  return (
    <div className="grid grid-cols-2 gap-3 tablet:gap-4 desktop:grid-cols-4">
      {tiles(stats).map((t) => {
        const hot = t.value > 0 && t.tone !== "neutral";
        return (
          <Link
            aria-label={`${t.label} ${t.value} ${t.hint}`}
            className={cn(
              "group flex flex-col gap-2 rounded-xl border bg-surface px-4.5 py-4 text-ink no-underline transition-colors duration-[120ms] hover:border-control hover:text-ink tablet:px-5 tablet:py-4.5",
              hot && t.tone === "warn"
                ? "border-[1.5px] border-warn bg-warn-soft"
                : "border-border",
            )}
            key={t.status}
            to={secretsByStatusPath(t.status)}
          >
            <span className="flex items-center justify-between gap-2 text-[0.875rem] font-bold [&_svg]:size-4">
              {t.label}
              {t.icon}
            </span>
            <span className="font-display text-[2.25rem] leading-none font-extrabold tracking-[-0.02em] tablet:text-[2.75rem]">
              {t.value}
            </span>
            <span
              className={cn(
                "text-small font-bold",
                hot && t.tone === "danger" && "text-danger",
                hot && t.tone === "warn" && "text-warn",
              )}
            >
              {t.hint} <span aria-hidden>→</span>
            </span>
          </Link>
        );
      })}
    </div>
  );
};
