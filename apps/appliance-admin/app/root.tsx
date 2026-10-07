import type { ReactNode } from "react";
import type { LinksFunction } from "react-router";

import { edge } from "@sneakers-web/edge";
import { Document, type RootData } from "@sneakers-web/shell";
import {
  type DisplaySettings,
  LiveRegion,
  parseDisplay,
  ThemeProvider,
  Toaster,
  TooltipProvider,
} from "@sneakers-web/ui";
import { Outlet } from "react-router";

import appCss from "@/app.css?url";

const DISPLAY_KEY = "osadmin_display";

export const clientLoader = (): RootData => ({
  banner: edge.banner,
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
  { href: appCss, rel: "stylesheet" },
  { href: `${import.meta.env.BASE_URL}favicon.svg`, rel: "icon", type: "image/svg+xml" },
  { href: `${import.meta.env.BASE_URL}app-icon.svg`, rel: "apple-touch-icon" },
];

export const Layout = ({ children }: { children: ReactNode }) => <Document>{children}</Document>;

export const meta = () => [{ title: "Sneakers-PAM appliance admin" }];

const Root = () => {
  const save = (settings: DisplaySettings) => {
    localStorage.setItem(DISPLAY_KEY, JSON.stringify(settings));
  };
  return (
    <ThemeProvider initial={parseDisplay(localStorage.getItem(DISPLAY_KEY))} onChange={save}>
      <TooltipProvider>
        <Outlet />
        <Toaster />
        <LiveRegion />
      </TooltipProvider>
    </ThemeProvider>
  );
};

export default Root;

export { RouteError as ErrorBoundary } from "@sneakers-web/shell";
