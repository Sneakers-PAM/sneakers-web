import { Clock } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "#ui/lib/cn";

/**
 * A countdown chip. Neutral normally, warn under the warn threshold and solid danger
 * under the danger threshold (10 and 1 minutes by default; agent approvals use 3 and 1).
 */
export const Countdown = ({
  className,
  dangerBelow = 60,
  label,
  until,
  warnBelow = 600,
}: {
  className?: string;
  dangerBelow?: number;
  label?: string;
  until: number;
  warnBelow?: number;
}) => {
  const left = useSecondsLeft(until);
  const tone = left < dangerBelow ? "danger" : left < warnBelow ? "warn" : "neutral";
  return (
    <span
      aria-label={label ? `${label}: ${formatDuration(left)} left` : `${formatDuration(left)} left`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[7px] border-[1.5px] px-1.75 py-1.25 font-mono text-[0.8125rem] leading-none font-bold",
        tone === "neutral" && "border-border-strong bg-sunken text-ink",
        tone === "warn" && "border-warn bg-warn-soft text-warn",
        tone === "danger" && "border-danger bg-danger text-on-danger",
        className,
      )}
      role="timer"
    >
      <Clock aria-hidden className="size-3.5" strokeWidth={2.5} />
      {formatDuration(left)}
    </span>
  );
};

export const formatDuration = (totalSeconds: number): string => {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const x = s % 60;
  const mm = h ? String(m).padStart(2, "0") : String(m);
  return `${h ? `${h}:` : ""}${mm}:${String(x).padStart(2, "0")}`;
};

/** Seconds left until `until` (ms since epoch), ticking once a second. */
export const useSecondsLeft = (until: number): number => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);
  return Math.max(0, Math.round((until - now) / 1000));
};
