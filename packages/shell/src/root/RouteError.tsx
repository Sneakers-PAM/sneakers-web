import { isRouteErrorResponse, useRouteError } from "react-router";

import { CrashScreen } from "#shell/CrashScreen";
import { NotFoundScreen, OfflineScreen } from "#shell/gate/Screens";

/**
 * The root error screen: the gateway being down gets "can't reach the server" (it retries on
 * its own), a missing page gets a not-found card, anything else the crash screen.
 */
export const RouteError = () => {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 503) return <OfflineScreen />;
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundScreen />;
  const crash =
    error instanceof Error
      ? error
      : new Error(isRouteErrorResponse(error) ? error.statusText : "Unknown error");
  return <CrashScreen error={crash} />;
};
