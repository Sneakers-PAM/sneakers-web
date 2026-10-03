import { Avatar, Button, Card, cn, Skeleton } from "@sneakers-web/ui";
import { Check, Minus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { RaciDecisionView, RulesetSimulatorProps, RulesetSubject } from "#shell/sharing/types";

import { SubjectPicker } from "#shell/sharing/SubjectPicker";

type Result = { decision: RaciDecisionView; run: Run; state: "ok" } | { run: Run; state: "error" };

interface Run {
  attempt: number;
  person: RulesetSubject;
  simulate: RulesetSimulatorProps["simulate"];
}

const ROWS = [
  { allowed: "reveal", label: "Reveal", reason: "revealReason" },
  { allowed: "informed", label: "Informed", reason: "informedReason" },
  { allowed: "approve", label: "Approve", reason: "approveReason" },
  { allowed: "manage", label: "Manage", reason: "manageReason" },
] as const;

/**
 * "What would this user get?": pick a person and see each RACI action's answer and the rule
 * behind it. Pure UI. `simulate` runs the app's `simulateFolder` / `simulateSecret` with the
 * current draft, and a new `simulate` (from `useCallback` over the draft) runs it again, so the
 * answer always reflects unsaved edits. `searchUsers` finds the person.
 */
export const RulesetSimulator = ({ searchUsers, simulate }: RulesetSimulatorProps) => {
  const [person, setPerson] = useState<null | RulesetSubject>(null);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<null | Result>(null);
  const search = useCallback(
    async (q: string) => {
      const found = await searchUsers(q);
      return found.filter((s) => s.kind === "user");
    },
    [searchUsers],
  );
  const run = useMemo<null | Run>(
    () => (person ? { attempt, person, simulate } : null),
    [attempt, person, simulate],
  );

  useEffect(() => {
    if (!run?.person.id) return;
    let live = true;
    run
      .simulate(run.person.id)
      .then((decision) => {
        if (live) setResult({ decision, run, state: "ok" });
      })
      .catch(() => {
        if (live) setResult({ run, state: "error" });
      });
    return () => {
      live = false;
    };
  }, [run]);

  // An answer for an earlier person or draft is stale: show the skeleton until this one lands.
  const current = result && result.run === run ? result : null;

  return (
    <Card className="flex flex-col gap-3.5 border-[1.5px] border-primary px-5.5 py-5">
      <h2 className="m-0 font-display text-[1.25rem] leading-none font-bold">Simulator</h2>
      <span className="text-[0.875rem] leading-[1.4] text-muted">
        Pick someone to see what they would get, and why.
      </span>
      <div className="flex flex-wrap items-center gap-2">
        {person && (
          <span className="flex items-center gap-2 rounded-full bg-ink py-1 pr-3 pl-1 text-bg">
            <Avatar className="rounded-full" name={person.name} size={26} />
            <b className="text-[0.875rem] font-bold">{person.name}</b>
          </span>
        )}
        <SubjectPicker
          exclude={person ? [person] : []}
          label="Pick a person"
          onPick={setPerson}
          options={[]}
          placeholder="Search people"
          search={search}
        />
      </div>
      <div aria-live="polite" className="flex flex-col gap-2">
        {run && !current && ROWS.map((r) => <Skeleton className="h-13 rounded-md" key={r.label} />)}
        {current?.state === "error" && person && (
          <div className="flex items-center gap-3 rounded-md bg-danger-soft px-3 py-2.75">
            <span className="flex-1 text-body">
              Couldn&apos;t check {person.name}&apos;s access.
            </span>
            <Button onClick={() => setAttempt((n) => n + 1)} size="sm" variant="secondary">
              Retry
            </Button>
          </div>
        )}
        {current?.state === "ok" &&
          ROWS.map((r) => {
            const yes = current.decision[r.allowed];
            return (
              <div
                className={cn(
                  "flex items-start gap-3 rounded-md px-3 py-2.75",
                  yes ? "bg-ok-soft" : "bg-sunken",
                )}
                key={r.label}
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full",
                    yes
                      ? "bg-ok text-surface"
                      : "border-[1.5px] border-dashed border-control text-muted",
                  )}
                >
                  {yes ? (
                    <Check className="size-4" strokeWidth={3} />
                  ) : (
                    <Minus className="size-4" />
                  )}
                </span>
                <div className="flex min-w-0 flex-col gap-1">
                  <b className="text-body leading-[1.2] font-bold">{`${r.label} · ${yes ? "Yes" : "No"}`}</b>
                  <span className="text-small leading-[1.4] text-muted">
                    {current.decision[r.reason]}
                  </span>
                </div>
              </div>
            );
          })}
      </div>
    </Card>
  );
};
