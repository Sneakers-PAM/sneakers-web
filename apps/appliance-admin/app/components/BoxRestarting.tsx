import { Alert, Button, Card, Spinner } from "@sneakers-web/ui";
import { type ReactNode, useEffect, useRef, useState } from "react";

import type { UpgradeProgress } from "@/lib/osadmin/types";

import { UpgradeSteps } from "@/components/UpgradeSteps";
import { boxAnswer, goToSignIn } from "@/lib/osadmin/restart";

/** How often :8443 is asked whether the box is back. */
export const RESTART_POLL_MS = 2000;
/** After this long without the box back, the page says how to get past a changed certificate. */
export const RESTART_SLOW_MS = 10 * 60_000;

type Phase = "back" | "checking" | "down" | "failed" | "going";

/** While the box is down, the reboot is the step it's on: the steps before it are done. */
const rebootingNow = (progress: UpgradeProgress): UpgradeProgress => {
  const at = progress.steps.findIndex((step) => step.id === "reboot");
  if (at === -1) return progress;
  return {
    ...progress,
    inProgress: true,
    steps: progress.steps.map((step, index) => ({
      ...step,
      detail: "",
      state:
        index < at
          ? "UPGRADE_STEP_STATE_DONE"
          : index === at
            ? "UPGRADE_STEP_STATE_ACTIVE"
            : "UPGRADE_STEP_STATE_PENDING",
    })),
  };
};

/**
 * The page every reboot shows (Apply, Revert, setup's Finish): it waits for the box to go
 * down, keeps asking until :8443 answers again, then calls onBack, by default a full load of
 * the sign-in page on a new TLS session. After an apply or a revert it lists the update's steps
 * from the public GetPhase: rebooting while the box is down, then checking health and marking
 * good once it answers, and it goes on only when they're done; a failed step stops it there,
 * with a Sign in button. It never leaves a dead page: after RESTART_SLOW_MS it offers a reload,
 * which is how the browser gets to check a certificate that changed.
 */
export const BoxRestarting = ({
  children,
  initialProgress,
  onBack = goToSignIn,
  pollMs = RESTART_POLL_MS,
  slowMs = RESTART_SLOW_MS,
  title = "The box is restarting",
  waitForDownMs = 0,
}: {
  children?: ReactNode;
  /** The update's steps as the page that started the restart last saw them. */
  initialProgress?: UpgradeProgress;
  onBack?: () => void;
  pollMs?: number;
  slowMs?: number;
  title?: string;
  /**
   * Until the box was seen down, or this long passed, a signed-out answer isn't "back": setup's
   * Finish ends the session before the reboot starts, so the box answers signed out for a few
   * seconds first, and links offered then would land on a box going down.
   */
  waitForDownMs?: number;
}) => {
  const [phase, setPhase] = useState<Phase>("going");
  const [answered, setProgress] = useState<UpgradeProgress>();
  const progress = answered ?? initialProgress;
  const [slow, setSlow] = useState(false);
  const back = useRef(onBack);
  useEffect(() => {
    back.current = onBack;
  }, [onBack]);

  useEffect(() => {
    let busy = false;
    let done = false;
    let seenDown = false;
    const started = Date.now();
    const tick = () => {
      if (busy || done) return;
      busy = true;
      let steps: undefined | UpgradeProgress;
      void boxAnswer((answer) => {
        steps = answer.upgradeProgress;
      })
        .then((answer) => {
          if (done) return;
          if (steps) setProgress(steps);
          if (answer === "down") {
            seenDown = true;
            setPhase("down");
          }
          if (answer !== "signed-out") return;
          if (waitForDownMs > 0 && !seenDown && Date.now() - started < waitForDownMs) return;
          if (steps?.inProgress) {
            setPhase("checking");
            return;
          }
          done = true;
          if (steps?.failed) {
            setPhase("failed");
            return;
          }
          setPhase("back");
          back.current();
        })
        .finally(() => {
          busy = false;
        });
    };
    const poll = setInterval(tick, pollMs);
    const late = setTimeout(() => setSlow(true), slowMs);
    return () => {
      done = true;
      clearInterval(poll);
      clearTimeout(late);
    };
  }, [pollMs, slowMs, waitForDownMs]);

  const shown = progress && phase === "down" ? rebootingNow(progress) : progress;
  const heading =
    phase === "back"
      ? "The box is back"
      : phase === "failed"
        ? "The update didn't finish"
        : phase === "checking"
          ? "The box is checking the release"
          : title;
  return (
    <section aria-label="Restarting" className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-col gap-3 p-5.5 text-small" role="status">
          <div className="flex items-center gap-3">
            {phase !== "back" && phase !== "failed" && <Spinner />}
            <h2 className="m-0 text-body font-bold">{heading}</h2>
          </div>
          {children}
          {shown && <UpgradeSteps progress={shown} />}
          <p className="m-0">
            {phase === "going" && "Waiting for the box to go down for the restart."}
            {phase === "down" &&
              "The box is down while it restarts. This page reconnects by itself when :8443 answers again; it can take a few minutes."}
            {phase === "checking" &&
              "It answers again. It checks its health and marks the release good; then sign in again."}
            {phase === "back" &&
              "It answers again. Every session ended with the restart, so sign in again."}
            {phase === "failed" &&
              "The box answers again, but a step failed. Every session ended with the restart: sign in to see Updates."}
          </p>
          {phase === "failed" && (
            <div>
              <Button onClick={() => back.current()} size="lg">
                Sign in
              </Button>
            </div>
          )}
        </div>
      </Card>
      {slow && phase !== "back" && phase !== "failed" && (
        <Alert
          action={
            <Button onClick={goToSignIn} size="sm" variant="secondary">
              Reload
            </Button>
          }
          title="This is taking longer than usual"
          tone="warn"
        >
          If the box made a new certificate while it restarted, this page can&apos;t reach it until
          the browser accepts it. Reload, check the fingerprint on the console, and sign in.
        </Alert>
      )}
    </section>
  );
};
