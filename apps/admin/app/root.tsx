import type { ReactNode } from "react";
import type { LinksFunction, LoaderFunctionArgs } from "react-router";

import { Document } from "@sneakers-web/shell";
import { rootLoader } from "@sneakers-web/shell/server";

import appCss from "@/app.css?url";

export const loader = (arguments_: LoaderFunctionArgs) => rootLoader(arguments_);

export const links: LinksFunction = () => [
  { href: appCss, rel: "stylesheet" },
  { href: `${import.meta.env.BASE_URL}favicon.svg`, rel: "icon", type: "image/svg+xml" },
  { href: `${import.meta.env.BASE_URL}app-icon.svg`, rel: "apple-touch-icon" },
];

export const Layout = ({ children }: { children: ReactNode }) => <Document>{children}</Document>;

export const meta = () => [{ title: "Sneakers-PAM admin console" }];

export { AppRoot as default, RouteError as ErrorBoundary } from "@sneakers-web/shell";
