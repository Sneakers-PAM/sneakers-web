import type { ReactNode } from "react";

import { cn, Spinner } from "@sneakers-web/ui";
import { Check, Circle, X } from "lucide-react";

import type { UpgradeProgress, UpgradeStep } from "@/lib/osadmin/types";

type State = "active" | "done" | "failed" | "pending";

const stateOf = (step: UpgradeStep): State => {
  switch (step.state) {
    case "UPGRADE_STEP_STATE_ACTIVE": {
      return "active";
    }
    case "UPGRADE_STEP_STATE_DONE": {
      return "done";
    }
    case "UPGRADE_STEP_STATE_FAILED": {
      return "failed";
    }
    default: {
      return "pending";
    }
  }
};

/** What each state is called next to its mark, so the colour is never the only signal. */
const WORD: Record<State, string> = {
  active: "Now",
  done: "Done",
  failed: "Failed",
  pending: "To come",
};

const MARK: Record<State, ReactNode> = {
  active: <Spinner />,
  done: <Check aria-hidden className="size-4 text-ok" />,
  failed: <X aria-hidden className="size-4 text-danger" />,
  pending: <Circle aria-hidden className="size-4 text-muted" />,
};

/** A byte count in MB or GB, one decimal. */
const size = (bytes: number): string =>
  bytes >= 2 ** 30 ? `${(bytes / 2 ** 30).toFixed(1)} GB` : `${(bytes / 2 ** 20).toFixed(1)} MB`;

const Progress = ({ step }: { step: UpgradeStep }) => {
  const total = Number(step.totalBytes);
  if (!(total > 0)) return null;
  const done = Math.min(Math.max(Number(step.doneBytes), 0), total);
  const percent = Math.floor((done * 100) / total);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <progress
        aria-label={step.label}
        className="h-3 w-full max-w-80 accent-primary"
        max={100}
        value={percent}
      />
      <span className="text-muted">{`${String(percent)}% (${size(done)} of ${size(total)})`}</span>
    </div>
  );
};

/**
 * An update's steps, in order, the way the console's maintenance screen lists them: each one
 * done, now, to come or failed, the current one with what it's doing (and its progress, while
 * the release is written into the slot), a failed one with why.
 */
export const UpgradeSteps = ({ progress }: { progress: UpgradeProgress }) => (
  <ol aria-label="Update steps" className="m-0 flex list-none flex-col gap-2 p-0">
    {progress.steps.map((step) => {
      const state = stateOf(step);
      return (
        <li
          aria-current={state === "active" ? "step" : undefined}
          className="flex flex-col gap-1"
          data-state={state}
          key={step.id}
        >
          <span className="flex items-center gap-2">
            <span className="flex size-4 items-center justify-center">{MARK[state]}</span>
            <span
              className={cn(
                state === "active" && "font-bold",
                state === "pending" && "text-muted",
                state === "failed" && "font-bold text-danger",
              )}
            >
              {step.label}
            </span>
            <span className="text-muted">{WORD[state]}</span>
          </span>
          {(state === "active" || state === "failed") && (
            <div className="flex flex-col gap-1 pl-6">
              {state === "active" && <Progress step={step} />}
              {step.detail && <p className="m-0">{step.detail}</p>}
            </div>
          )}
        </li>
      );
    })}
  </ol>
);
