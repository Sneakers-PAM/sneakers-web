import { Alert, Button } from "@sneakers-web/ui";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";

import type { GetStatusResponse, NetworkChange, UpgradeProgress } from "@/lib/osadmin/types";

import { subscribeNetworkChange } from "@/lib/networkChange";
import { status } from "@/lib/osadmin/client";

/**
 * The frame's notices from GetStatus, on every :8443 page: a network change waiting to be kept,
 * and a base update under way that will end this session. Read on every page change and whenever
 * the Network page changes something.
 */
export const StatusBanners = ({ pathname }: { pathname: string }) => {
  const [data, setData] = useState<GetStatusResponse>();
  const [readAt, setReadAt] = useState(0);
  const read = useCallback(
    () =>
      void status
        .get()
        .then((response) => {
          setData(response);
          setReadAt(Date.now());
        })
        .catch(() => {
          // Status isn't answering; the banners wait for the next page change.
        }),
    [],
  );
  useEffect(read, [read, pathname]);
  useEffect(() => subscribeNetworkChange(read), [read]);
  return (
    <>
      {pathname !== "/network" && data?.networkChange?.pending && (
        <NetworkChangeBanner change={data.networkChange} onEnded={read} readAt={readAt} />
      )}
      {pathname !== "/updates" && data?.upgradeProgress && (
        <UpdateUnderWay progress={data.upgradeProgress} />
      )}
    </>
  );
};

/**
 * A network change waiting to be kept, on every page but Network (which shows its own banner,
 * with the button): it counts down the seconds the box reported and links to Network.
 */
const NetworkChangeBanner = ({
  change,
  onEnded,
  readAt,
}: {
  change: NetworkChange;
  onEnded: () => void;
  readAt: number;
}) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const deadline = readAt + change.revertSecondsLeft * 1000;
  const secondsLeft = Math.max(0, Math.ceil((deadline - Math.max(now, readAt)) / 1000));
  useEffect(() => {
    if (secondsLeft === 0) onEnded();
  }, [secondsLeft, onEnded]);
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

/**
 * A base apply or revert another admin started: the box reboots and every session ends, this one
 * included, so the admin hears it before it happens. A product update doesn't end sessions.
 */
const UpdateUnderWay = ({ progress }: { progress: UpgradeProgress }) => {
  if (!progress.inProgress || progress.target === "UPDATE_TARGET_PRODUCT") return null;
  if (progress.action !== "apply" && progress.action !== "revert") return null;
  return (
    <Alert role="status" title="The box is about to restart" tone="warn">
      {progress.action === "apply"
        ? `An update to ${progress.version || "a new release"} is under way.`
        : `A revert to ${progress.version || "the previous release"} is under way.`}{" "}
      The box reboots, and every session ends, this one included. Finish what you&apos;re doing;
      sign in again once it&apos;s back.
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
