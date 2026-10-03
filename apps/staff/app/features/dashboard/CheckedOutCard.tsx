import { Button, clockTime, formatDuration, useSecondsLeft } from "@sneakers-web/ui";
import { ArrowLeftRight } from "lucide-react";
import { Link } from "react-router";

import type { CheckoutCard } from "@/features/dashboard/dashboard.server";

import { QuickCard } from "@/features/dashboard/QuickCard";

/** The user holds a checkout: time left, and the nudge to check it in so it rotates. */
export const CheckedOutCard = ({ checkouts }: { checkouts: CheckoutCard[] }) => {
  const next = checkouts.toSorted((a, b) => a.expiresAt.localeCompare(b.expiresAt))[0];
  const ends = next ? Date.parse(next.expiresAt) : 0;
  const left = useSecondsLeft(ends);
  if (!next) return null;
  const more = checkouts.length - 1;
  return (
    <QuickCard
      icon={<ArrowLeftRight />}
      iconClassName="bg-ok text-surface"
      title={`${next.secretName} is checked out`}
    >
      <p className="m-0 flex flex-wrap items-baseline gap-x-2.5">
        {/* The server and the browser read the clock a moment apart. */}
        <span
          className="font-mono text-[1.875rem] leading-none font-bold"
          role="timer"
          suppressHydrationWarning
        >
          {formatDuration(left)}
        </span>
        <span className="text-small text-muted">left · ends {clockTime(ends)}</span>
      </p>
      <div className="mt-auto flex items-center justify-between gap-3">
        <span className="text-small text-muted">
          {more > 0
            ? `And ${more} more checked out. Check in when done to rotate them.`
            : "Check in when done to rotate it."}
        </span>
        <Button asChild size="sm" variant="ink">
          <Link to="/checkouts">Check in</Link>
        </Button>
      </div>
    </QuickCard>
  );
};
