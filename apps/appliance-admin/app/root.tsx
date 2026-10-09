import type { ReactNode } from "react";
import type {
  ClientLoaderFunctionArgs,
  LinksFunction,
  ShouldRevalidateFunction,
} from "react-router";

import { edge } from "@sneakers-web/edge";
import {
  DiagnosticsCopierProvider,
  Document,
  type RootData,
  RouteError,
} from "@sneakers-web/shell";
import {
  type DisplaySettings,
  LiveRegion,
  parseDisplay,
  ThemeProvider,
  Toaster,
  TooltipProvider,
} from "@sneakers-web/ui";
import { isRouteErrorResponse, Outlet, redirect, useRouteError } from "react-router";

import appCss from "@/app.css?url";
import { AccessScreen, ServerErrorScreen } from "@/components/ErrorScreens";
import { copyApplianceDiagnostics } from "@/lib/diagnostics/copy";
import { getPhase, knownNormal } from "@/lib/phase";
import { useReadyMarker } from "@/lib/readiness";

const DISPLAY_KEY = "osadmin_display";

/** Before setup is done every page but /setup goes there, sign-in included. */
export const clientLoader = async ({
  request,
}: Pick<ClientLoaderFunctionArgs, "request">): Promise<RootData> => {
  const { pathname } = new URL(request.url);
  if (pathname !== "/setup" && (await getPhase()) === "firstboot") throw redirect("/setup");
  return rootData();
};

/** While setup isn't known to be done, every navigation asks again. */
export const shouldRevalidate: ShouldRevalidateFunction = ({ defaultShouldRevalidate }) =>
  !knownNormal() || defaultShouldRevalidate;

const rootData = (): RootData => ({
  banner: edge.banner,
  boxPoller: false,
  config: {
    adminUrl: "/",
    appEnv: edge.mode === "mock" ? "dev" : "prod",
    logLevel: "error",
    sso: false,
    staffUrl: "/",
    version: __APP_VERSION__,
  },
  developmentUiIssueCopy: edge.mode === "mock",
  display: parseDisplay(localStorage.getItem(DISPLAY_KEY)),
  needsSetup: false,
  storagePrefix: edge.mode === "mock" ? "mock:" : "",
});

export const links: LinksFunction = () => [
  // With a precedence React hoists the stylesheet like the icons; without one it hydrates it in
  // place, and the prerendered <head> (charset first) never matches, so hydration fails (#418).
  { href: appCss, precedence: "default", rel: "stylesheet" },
  { href: `${import.meta.env.BASE_URL}favicon.svg`, rel: "icon", type: "image/svg+xml" },
  { href: `${import.meta.env.BASE_URL}app-icon.svg`, rel: "apple-touch-icon" },
];

/** Every Copy diagnostics button copies the appliance report, never the product's. */
const ApplianceDiagnostics = ({ children }: { children: ReactNode }) => (
  <DiagnosticsCopierProvider value={copyApplianceDiagnostics}>{children}</DiagnosticsCopierProvider>
);

export const Layout = ({ children }: { children: ReactNode }) => <Document>{children}</Document>;

export const meta = () => [{ title: "Sneakers-PAM appliance admin" }];

const Root = () => {
  useReadyMarker();
  const save = (settings: DisplaySettings) => {
    localStorage.setItem(DISPLAY_KEY, JSON.stringify(settings));
  };
  return (
    <ThemeProvider initial={parseDisplay(localStorage.getItem(DISPLAY_KEY))} onChange={save}>
      <TooltipProvider>
        <ApplianceDiagnostics>
          <Outlet />
        </ApplianceDiagnostics>
        {/* Bottom centre: the accessibility widget holds the bottom right corner. */}
        <Toaster position="bottom-center" />
        <LiveRegion />
      </TooltipProvider>
    </ThemeProvider>
  );
};

export default Root;

/**
 * 401 and 403 get the real sign-in-again or not-allowed page, and a 5xx that isn't the
 * gateway-unreachable case (503, shell's OfflineScreen) gets "the box had a problem"; every
 * other status or thrown error still goes through shell's RouteError (404, 503, crash).
 */
const ErrorScreen = () => {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && (error.status === 401 || error.status === 403)) {
    return <AccessScreen status={error.status} />;
  }
  if (isRouteErrorResponse(error) && error.status >= 500 && error.status !== 503) {
    return <ServerErrorScreen />;
  }
  return <RouteError />;
};

export const ErrorBoundary = () => (
  <ApplianceDiagnostics>
    <ErrorScreen />
  </ApplianceDiagnostics>
);
