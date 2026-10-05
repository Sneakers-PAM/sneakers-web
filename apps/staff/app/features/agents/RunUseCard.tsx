import { Card, Checkbox, cn, Countdown, Pill } from "@sneakers-web/ui";
import { Eye } from "lucide-react";
import { useId } from "react";

import type { RunUse } from "@/features/agents/run.server";

// Agent approvals go warn under 3 minutes and solid danger under one, as on the approvals list.
const WARN_BELOW_S = 180;
const DANGER_BELOW_S = 60;

export interface RunUseCardProps {
  checked: boolean;
  expired: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Show the use's own task, when the run's uses don't share one. */
  showPurpose: boolean;
  use: RunUse;
}

/** One pending use on the run page: what it releases, to what, until when, and its tick. */
export const RunUseCard = ({
  checked,
  expired,
  onCheckedChange,
  showPurpose,
  use: u,
}: RunUseCardProps) => {
  const titleId = useId();
  const danger = u.reveal && !expired;
  return (
    <Card
      aria-labelledby={titleId}
      className={cn(
        "flex gap-3 px-4 py-3.5",
        danger && "border-danger bg-danger-soft",
        expired && "opacity-60",
      )}
      role="group"
    >
      <Checkbox
        aria-label={`Include ${u.secretName}`}
        checked={checked && !expired}
        className="mt-0.5"
        disabled={expired}
        onCheckedChange={(next) => onCheckedChange(next === true)}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <b className="text-body leading-[1.3]" id={titleId}>
            {u.secretName}
          </b>
          <span className="font-mono text-[0.8125rem] text-muted">{u.fieldKey}</span>
          <span className="ml-auto">
            {expired ? (
              <Pill tone="neutral">Expired</Pill>
            ) : (
              <Countdown
                dangerBelow={DANGER_BELOW_S}
                label={u.secretName}
                until={u.expiresAt}
                warnBelow={WARN_BELOW_S}
              />
            )}
          </span>
        </div>
        {u.reveal ? (
          <span className="flex flex-wrap items-center gap-2 text-[0.875rem]">
            <span className="font-bold">Reveal to the agent</span>
            <Pill icon={<Eye aria-hidden />} tone="danger">
              Reveals value to agent
            </Pill>
          </span>
        ) : (
          <code className="font-mono text-[0.8125rem] break-all">{u.command}</code>
        )}
        {showPurpose && u.purpose && (
          <span className="text-[0.875rem] leading-[1.4] text-muted">
            <span className="font-bold">Agent says: </span>
            {u.purpose}
          </span>
        )}
      </div>
    </Card>
  );
};
