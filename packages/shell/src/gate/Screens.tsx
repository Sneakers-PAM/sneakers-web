import { useFormat, useT } from "@sneakers-web/i18n";
import { Button, SneakerLoader, Spinner } from "@sneakers-web/ui";
import { useEffect, useState } from "react";
import { Link } from "react-router";

import { CopyDiagnostics } from "#shell/diagnostics/CopyDiagnostics";
import { CenteredFrame, FrameTitle } from "#shell/gate/Frames";
import { EdgeBanner } from "#shell/layout/EdgeBanner";

export const AUTO_RETRY_SECONDS = 20;

/** G-01: shown while the app reaches the gateway again. */
export const ConnectingScreen = () => {
  const t = useT();
  return (
    <div className="flex min-h-dvh flex-col bg-sunken">
      <EdgeBanner />
      <main className="flex flex-1 flex-col items-center justify-center gap-5.5" role="status">
        <SneakerLoader hole="var(--color-sunken)" size={120} />
        <div className="flex items-center gap-3 text-[1.0625rem] font-bold">
          <Spinner />
          {t("gate.connecting")}
        </div>
      </main>
    </div>
  );
};

/**
 * G-02: the gateway didn't answer. It tries again on its own every 20 seconds (a reload,
 * so it works the same before and after the page's scripts load).
 */
export const OfflineScreen = () => {
  const t = useT();
  const format = useFormat();
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
      <FrameTitle body={t("gate.offline.body")} title={t("gate.offline.title")} />
      <div className="flex gap-2.5">
        <Button
          loading={retrying}
          loadingLabel={t("gate.offline.retrying")}
          onClick={() => {
            setRetrying(true);
            globalThis.location.reload();
          }}
          size="lg"
        >
          {t("gate.offline.retry")}
        </Button>
        <CopyDiagnostics problem={{ message: t("gate.offline.title") }} size="lg" />
      </div>
      <span aria-live="polite" className="text-small leading-[1.4] text-muted">
        {t("gate.offline.status", {
          retrying: String(retrying),
          seconds: left,
          time: format.time(triedAt),
        })}
      </span>
    </CenteredFrame>
  );
};

/** G-03: installed, but nobody has finished setup. Deliberately doesn't link the setup page. */
export const NotSetUpScreen = () => {
  const t = useT();
  return (
    <CenteredFrame>
      <FrameTitle body={t("gate.notSetUp.body")} title={t("gate.notSetUp.title")} />
      <span className="text-[0.875rem] leading-[1.45] text-muted">{t("gate.notSetUp.hint")}</span>
    </CenteredFrame>
  );
};

/** A link that leads nowhere. */
export const NotFoundScreen = () => {
  const t = useT();
  return (
    <CenteredFrame>
      <FrameTitle body={t("gate.notFound.body")} title={t("gate.notFound.title")} />
      <div className="flex flex-wrap gap-2.5">
        <Button asChild>
          <Link to="/">{t("gate.notFound.start")}</Link>
        </Button>
        <CopyDiagnostics problem={{ message: t("gate.notFound.problem") }} size="md" />
      </div>
    </CenteredFrame>
  );
};
