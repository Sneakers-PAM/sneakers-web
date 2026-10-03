import { Button, Countdown, useIsClient } from "@sneakers-web/ui";
import { SquareTerminal } from "lucide-react";
import { Link } from "react-router";

import type { AgentCard } from "@/features/dashboard/dashboard.server";

import { QuickCard } from "@/features/dashboard/QuickCard";

/** An agent asked to use a secret and waits for the owner's answer before its request expires. */
export const AgentWaitingCard = ({ agents }: { agents: AgentCard[] }) => {
  const client = useIsClient();
  const next = agents.toSorted((a, b) => a.expiresAt - b.expiresAt)[0];
  if (!next) return null;
  return (
    <QuickCard
      aside={
        // A ticking chip rendered on the server would never match the browser's first frame.
        client && (
          <Countdown
            dangerBelow={60}
            label="Answer within"
            until={next.expiresAt}
            warnBelow={180}
          />
        )
      }
      className="border-[1.5px] border-primary"
      icon={<SquareTerminal />}
      iconClassName="bg-primary text-on-primary"
      title={agents.length > 1 ? `${agents.length} agents are waiting` : "Agent is waiting"}
    >
      <code className="block truncate rounded-md bg-term-bg px-3.5 py-2.5 font-mono text-code text-term-fg">
        {next.command ?? `Wants the ${next.fieldKey} value itself`}
      </code>
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 truncate text-small text-muted">
          {next.secretName} · {next.fieldKey} · {next.clientLabel}
        </span>
        <Button asChild size="sm">
          <Link to="/approvals">Review</Link>
        </Button>
      </div>
    </QuickCard>
  );
};
