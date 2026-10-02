import { Button, SneakerLoader, Spinner } from "@sneakers-web/ui";
import { useEffect, useState } from "react";

import { CenteredFrame, FrameTitle } from "#shell/gate/Frames";
import { AUTO_RETRY_SECONDS } from "#shell/gate/useGatewayProbe";
import { EdgeBanner } from "#shell/layout/EdgeBanner";

/** G-01: the app is reaching the gateway. */
export const ConnectingScreen = () => {
  return (
    <div className="flex min-h-dvh flex-col bg-sunken">
      <EdgeBanner />
      <main className="flex flex-1 flex-col items-center justify-center gap-5.5" role="status">
        <SneakerLoader hole="var(--color-sunken)" size={120} />
        <div className="flex items-center gap-3 text-[1.0625rem] font-bold">
          <Spinner />
          Connecting…
        </div>
      </main>
    </div>
  );
};

const clock = (d: Date) =>
  d.toLocaleTimeString([], { hour: "2-digit", hour12: false, minute: "2-digit" });

/** G-03: installed, but nobody has finished setup. Deliberately doesn't link the setup page. */
export const NotSetUpScreen = () => {
  return (
    <CenteredFrame>
      <FrameTitle
        body="Sneakers-PAM is installed but has no administrator. Ask whoever runs it in your organisation to finish setup."
        title="Not set up yet"
      />
      <span className="text-[0.875rem] leading-[1.45] text-muted">Nothing to do here for now.</span>
    </CenteredFrame>
  );
};

/** G-02: the gateway didn't answer. Retries on its own every 20 seconds. */
export const OfflineScreen = ({
  onRetry,
  retrying,
  triedAt,
}: {
  onRetry: () => void;
  retrying: boolean;
  triedAt: Date;
}) => {
  const [left, setLeft] = useState(AUTO_RETRY_SECONDS);
  useEffect(() => {
    const iv = setInterval(() => {
      setLeft(
        Math.max(0, AUTO_RETRY_SECONDS - Math.round((Date.now() - triedAt.getTime()) / 1000)),
      );
    }, 1000);
    return () => clearInterval(iv);
  }, [triedAt]);
  return (
    <CenteredFrame>
      <FrameTitle
        body="Sneakers-PAM is not answering. Check your connection or VPN. If others can sign in, the server may be restarting."
        title="Can't reach the server"
      />
      <div className="flex gap-2.5">
        <Button loading={retrying} loadingLabel="Retrying…" onClick={onRetry} size="lg">
          Retry
        </Button>
      </div>
      <span aria-live="polite" className="text-small leading-[1.4] text-muted">
        Tried {globalThis.location.host} at {clock(triedAt)}.{" "}
        {retrying ? "Trying again now." : `Next automatic try in ${left} s.`}
      </span>
    </CenteredFrame>
  );
};
