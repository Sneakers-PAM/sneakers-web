import { setLogLevel } from "@sneakers-web/api-client";
import {
  displayClassName,
  type DisplaySettings,
  LiveRegion,
  ThemeProvider,
  Toaster,
  TooltipProvider,
} from "@sneakers-web/ui";
import { type ReactNode, useCallback, useEffect } from "react";
import { Links, Meta, Outlet, Scripts, ScrollRestoration, useFetcher } from "react-router";

import { NotSetUpScreen } from "#shell/gate/Screens";
import { useRootData } from "#shell/root/useRootData";

/**
 * The HTML document every app renders. The server sets the theme classes and text size from
 * the display cookie, so the first paint is already in the right theme.
 */
export const Document = ({ children }: { children: ReactNode }) => {
  const { display } = useRootData();
  return (
    <html
      className={displayClassName(display)}
      lang="en"
      style={{ "--text-scale": String(display.textScale) } as React.CSSProperties}
    >
      <head>
        <meta charSet="utf-8" />
        <meta content="width=device-width, initial-scale=1" name="viewport" />
        <meta content="light dark" name="color-scheme" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
};

/**
 * Providers for the whole app: display settings (saved through the server), tooltips and
 * toasts. An install with no administrator yet shows `whenNotSetUp` instead of any page.
 */
export const AppRoot = ({ whenNotSetUp }: { whenNotSetUp?: ReactNode }) => {
  const { config, display, needsSetup } = useRootData();
  const fetcher = useFetcher();
  useEffect(() => setLogLevel(config.logLevel), [config.logLevel]);
  const save = useCallback(
    (settings: DisplaySettings) =>
      fetcher.submit(
        { settings: JSON.stringify(settings) },
        { action: "/resources/display", method: "post" },
      ),
    // fetcher.submit is stable for the life of the fetcher.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  return (
    <ThemeProvider initial={display} onChange={save}>
      <TooltipProvider>
        {needsSetup ? (whenNotSetUp ?? <NotSetUpScreen />) : <Outlet />}
        <Toaster />
        <LiveRegion />
      </TooltipProvider>
    </ThemeProvider>
  );
};
