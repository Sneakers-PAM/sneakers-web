import { setLogLevel } from "@sneakers-web/api-client";
import {
  displayClassName,
  type DisplaySettings,
  LiveRegion,
  type ProblemAction,
  ProblemActionProvider,
  setToastProblemAction,
  ThemeProvider,
  Toaster,
  TooltipProvider,
} from "@sneakers-web/ui";
import { type ReactNode, useCallback, useEffect, useMemo } from "react";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useFetcher,
  useHref,
  useMatches,
} from "react-router";

import { copyWithNotice, DIAGNOSTICS_ROUTE } from "#shell/diagnostics/copy";
import { problemFor, setCurrentRoute } from "#shell/diagnostics/problems";
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
 * Copy diagnostics on every problem treatment: danger and warning alerts (through the
 * provider) and error toasts (registered once in the browser).
 */
const useProblemAction = (): ProblemAction => {
  const url = useHref(DIAGNOSTICS_ROUTE);
  const route = useMatches().at(-1)?.id;
  useEffect(() => setCurrentRoute(route), [route]);
  const action = useMemo<ProblemAction>(
    () => ({
      label: "Copy diagnostics",
      run: (message?: string) => copyWithNotice({ problem: problemFor(message), url }),
    }),
    [url],
  );
  useEffect(() => {
    setToastProblemAction(action);
    return () => setToastProblemAction(null);
  }, [action]);
  return action;
};

/** Copy diagnostics for the problem treatments below it. AppRoot mounts it; so do the route stubs. */
export const ProblemActions = ({ children }: { children: ReactNode }) => (
  <ProblemActionProvider value={useProblemAction()}>{children}</ProblemActionProvider>
);

/**
 * Providers for the whole app: display settings (saved through the server), tooltips,
 * toasts and Copy diagnostics. An install with no administrator yet shows `whenNotSetUp`
 * instead of any page.
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
        <ProblemActions>
          {needsSetup ? (whenNotSetUp ?? <NotSetUpScreen />) : <Outlet />}
        </ProblemActions>
        <Toaster />
        <LiveRegion />
      </TooltipProvider>
    </ThemeProvider>
  );
};
