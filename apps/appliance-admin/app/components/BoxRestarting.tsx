import { Alert, Button, Card, Spinner } from "@sneakers-web/ui";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { boxAnswer, goToSignIn } from "@/lib/osadmin/restart";

/** How often :8443 is asked whether the box is back. */
export const RESTART_POLL_MS = 2000;
/** After this long without the box back, the page says how to get past a changed certificate. */
export const RESTART_SLOW_MS = 10 * 60_000;

type Phase = "back" | "down" | "going";

/**
 * The page every reboot shows (Apply, Revert, setup's Finish): it waits for the box to go
 * down, keeps asking until :8443 answers again, then calls onBack, by default a full load of
 * the sign-in page on a new TLS session. It never leaves a dead page: after RESTART_SLOW_MS it
 * offers a reload, which is how the browser gets to check a certificate that changed.
 */
export const BoxRestarting = ({
  children,
  onBack = goToSignIn,
  pollMs = RESTART_POLL_MS,
  slowMs = RESTART_SLOW_MS,
  title = "The box is restarting",
}: {
  children?: ReactNode;
  onBack?: () => void;
  pollMs?: number;
  slowMs?: number;
  title?: string;
}) => {
  const [phase, setPhase] = useState<Phase>("going");
  const [slow, setSlow] = useState(false);
  const back = useRef(onBack);
  useEffect(() => {
    back.current = onBack;
  }, [onBack]);

  useEffect(() => {
    let busy = false;
    let done = false;
    const tick = () => {
      if (busy || done) return;
      busy = true;
      void boxAnswer()
        .then((answer) => {
          if (done) return;
          if (answer === "down") setPhase("down");
          if (answer === "signed-out") {
            done = true;
            setPhase("back");
            back.current();
          }
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
  }, [pollMs, slowMs]);

  return (
    <section aria-label="Restarting" className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-col gap-3 p-5.5 text-small" role="status">
          <div className="flex items-center gap-3">
            {phase !== "back" && <Spinner />}
            <h2 className="m-0 text-body font-bold">
              {phase === "back" ? "The box is back" : title}
            </h2>
          </div>
          {children}
          <p className="m-0">
            {phase === "going" && "Waiting for the box to go down for the restart."}
            {phase === "down" &&
              "The box is down while it restarts. This page reconnects by itself when :8443 answers again; it can take a few minutes."}
            {phase === "back" &&
              "It answers again. Every session ended with the restart, so sign in again."}
          </p>
        </div>
      </Card>
      {slow && phase !== "back" && (
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
