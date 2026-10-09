import { Alert, Button } from "@sneakers-web/ui";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";

import type { NetworkChange } from "@/lib/osadmin/types";

import { subscribeNetworkChange } from "@/lib/networkChange";
import { status } from "@/lib/osadmin/client";

/**
 * A network change waiting to be kept, on every :8443 page but Network (which shows its own
 * banner, with the button): it counts down the seconds the box reports and links to Network.
 * Read from GetStatus on every page change and whenever the Network page changes something.
 */
export const NetworkChangeBanner = ({ pathname }: { pathname: string }) => {
  const [change, setChange] = useState<NetworkChange>();
  const [deadline, setDeadline] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const read = useCallback(
    () =>
      void status
        .get()
        .then((response) => {
          setChange(response.networkChange);
          setNow(Date.now());
          setDeadline(Date.now() + (response.networkChange?.revertSecondsLeft ?? 0) * 1000);
        })
        .catch(() => {
          // Status isn't answering; the banner waits for the next page change.
        }),
    [],
  );
  useEffect(read, [read, pathname]);
  useEffect(() => subscribeNetworkChange(read), [read]);
  const pending = !!change?.pending;
  const secondsLeft = Math.max(0, Math.ceil((deadline - now) / 1000));
  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [pending]);
  useEffect(() => {
    if (pending && secondsLeft === 0) read();
  }, [pending, secondsLeft, read]);

  if (!pending || pathname === "/network") return null;
  return (
    <Alert
      action={
        <Button asChild size="sm" variant="secondary">
          <Link to="/network">Open Network</Link>
        </Button>
      }
      role="status"
      tone="warn"
    >
      A network change{change.changeId ? ` (${change.changeId})` : ""} is waiting to be kept. It
      reverts in {secondsLeft} seconds unless an owner keeps it on the Network page.
    </Alert>
  );
};

/** The last network change nobody kept, which the box undid: on Network and Status. */
export const NetworkReverted = ({ atStart, changeId }: { atStart: boolean; changeId: string }) => (
  <Alert role="status" title="A network change was undone" tone="warn">
    The last network change{changeId ? ` (${changeId})` : ""} wasn&apos;t kept, so the box undid it
    and the earlier settings are back.{" "}
    {atStart
      ? "The box restarted before it was kept (a reboot or an update inside its window), and put them back when it started."
      : "Nobody kept it before its window ended."}{" "}
    Apply it again and keep it to make it stick.
  </Alert>
);
