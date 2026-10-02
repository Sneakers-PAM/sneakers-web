import { useIsClient } from "@sneakers-web/ui";
import { useEffect, useState } from "react";

const ago = (seconds: number): string =>
  seconds < 5
    ? "just now"
    : seconds < 60
      ? `${seconds}s ago`
      : `${Math.floor(seconds / 60)} min ago`;

/** "Live · updated 12s ago": the frame refreshes the page quietly, so this counts up between loads. */
export const LiveStamp = ({ loadedAt }: { loadedAt: number }) => {
  const client = useIsClient();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [loadedAt]);
  const seconds = Math.max(0, Math.round((now - loadedAt) / 1000));
  return (
    <span className="inline-flex items-center gap-2 text-small text-muted">
      <span aria-hidden className="size-2 rounded-full bg-ok" />
      Live · updated {client ? ago(seconds) : "just now"}
    </span>
  );
};
