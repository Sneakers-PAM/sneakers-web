import { cn } from "@sneakers-web/ui";
import { Minus, Plus } from "lucide-react";

const PRESETS = [1, 8, 24];

/** The grant window: a stepper from 1 to `max` hours, and the 1, 8 and 24 hour presets. */
export const HoursStepper = ({
  max,
  onChange,
  value,
}: {
  max: number;
  onChange: (hours: number) => void;
  value: number;
}) => (
  <div className="flex flex-wrap items-center gap-2">
    <div className="flex h-11 items-stretch overflow-hidden rounded-md border-[1.5px] border-border-strong">
      <button
        aria-label="Fewer hours"
        className="flex w-11 items-center justify-center hover:bg-sunken disabled:text-border-strong"
        disabled={value <= 1}
        onClick={() => onChange(Math.max(1, value - 1))}
        type="button"
      >
        <Minus aria-hidden className="size-4" strokeWidth={3} />
      </button>
      <output
        aria-live="polite"
        className="flex w-16 items-center justify-center border-x-[1.5px] border-border-strong font-mono font-bold"
      >
        {value} h
      </output>
      <button
        aria-label="More hours"
        className="flex w-11 items-center justify-center hover:bg-sunken disabled:text-border-strong"
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        type="button"
      >
        <Plus aria-hidden className="size-4" strokeWidth={3} />
      </button>
    </div>
    <div className="flex gap-1.5">
      {PRESETS.filter((h) => h <= max).map((h) => (
        <button
          aria-pressed={value === h}
          className={cn(
            "h-9 rounded-full px-2.5 font-mono text-small font-bold",
            value === h
              ? "bg-ink text-bg"
              : "border-[1.5px] border-border-strong bg-surface text-ink",
          )}
          key={h}
          onClick={() => onChange(h)}
          type="button"
        >
          {h} h
        </button>
      ))}
    </div>
  </div>
);
