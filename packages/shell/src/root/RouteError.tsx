import { useEffect } from "react";
import { isRouteErrorResponse, useRouteError } from "react-router";

import { CrashScreen } from "#shell/CrashScreen";
import { NotFoundScreen, OfflineScreen } from "#shell/gate/Screens";
import { recordIssueCopyError } from "#shell/issueCopy/errorBuffer";
import { useRootData } from "#shell/root/useRootData";

/**
 * The root error screen: the gateway being down gets "can't reach the server" (it retries on
 * its own), a missing page gets a not-found card, anything else the crash screen. A genuine
 * crash also lands in the UI issue copy ring buffer, while that dev-only feature is on.
 */
export const RouteError = () => {
  const error = useRouteError();
  const { developmentUiIssueCopy } = useRootData();
  const known = isRouteErrorResponse(error) && (error.status === 503 || error.status === 404);
  const crash =
    error instanceof Error
      ? error
      : new Error(isRouteErrorResponse(error) ? error.statusText : "Unknown error");
  useEffect(() => {
    if (
      !known &&
      import.meta.env.SNEAKERS_DEV_UI_ISSUE_COPY_BUILD === "true" &&
      developmentUiIssueCopy
    ) {
      recordIssueCopyError("render", crash.message);
    }
  }, [crash.message, developmentUiIssueCopy, known]);
  if (isRouteErrorResponse(error) && error.status === 503) return <OfflineScreen />;
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundScreen />;
  return <CrashScreen error={crash} />;
};
