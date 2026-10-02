import { Button, clockTime, SneakerLoader, Spinner } from "@sneakers-web/ui";
import { useEffect, useState } from "react";
import { Link } from "react-router";

import { CenteredFrame, FrameTitle } from "#shell/gate/Frames";
import { EdgeBanner } from "#shell/layout/EdgeBanner";

export const AUTO_RETRY_SECONDS = 20;

/** G-01: shown while the app reaches the gateway again. */
export const ConnectingScreen = () => (
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

/**
 * G-02: the gateway didn't answer. It tries again on its own every 20 seconds (a reload,
 * so it works the same before and after the page's scripts load).
 */
export const OfflineScreen = () => {
  const [triedAt] = useState(() => new Date());
  const [left, setLeft] = useState(AUTO_RETRY_SECONDS);
  const [retrying, setRetrying] = useState(false);
  useEffect(() => {
    const iv = setInterval(() => {
      const remaining = AUTO_RETRY_SECONDS - Math.round((Date.now() - triedAt.getTime()) / 1000);
      setLeft(Math.max(0, remaining));
      if (remaining <= 0) {
        setRetrying(true);
        globalThis.location.reload();
      }
    }, 1000);
    return () => clearInterval(iv);
  }, [triedAt]);
  return (
    <CenteredFrame>
      <meta content={String(AUTO_RETRY_SECONDS)} httpEquiv="refresh" />
      <FrameTitle
        body="Sneakers-PAM is not answering. Check your connection or VPN. If others can sign in, the server may be restarting."
        title="Can't reach the server"
      />
      <div className="flex gap-2.5">
        <Button
          loading={retrying}
          loadingLabel="Retrying…"
          onClick={() => {
            setRetrying(true);
            globalThis.location.reload();
          }}
          size="lg"
        >
          Retry
        </Button>
      </div>
      <span aria-live="polite" className="text-small leading-[1.4] text-muted">
        Tried at {clockTime(triedAt)}.{" "}
        {retrying ? "Trying again now." : `Next automatic try in ${left} s.`}
      </span>
    </CenteredFrame>
  );
};

/** G-03: installed, but nobody has finished setup. Deliberately doesn't link the setup page. */
export const NotSetUpScreen = () => (
  <CenteredFrame>
    <FrameTitle
      body="Sneakers-PAM is installed but has no administrator. Ask whoever runs it in your organisation to finish setup."
      title="Not set up yet"
    />
    <span className="text-[0.875rem] leading-[1.45] text-muted">Nothing to do here for now.</span>
  </CenteredFrame>
);

/** A link that leads nowhere. */
export const NotFoundScreen = () => (
  <CenteredFrame>
    <FrameTitle
      body="That page doesn't exist, or it moved. Check the address, or start from the top."
      title="Nothing here"
    />
    <div>
      <Button asChild>
        <Link to="/">Go to the start</Link>
      </Button>
    </div>
  </CenteredFrame>
);
