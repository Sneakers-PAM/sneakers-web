import type { ReactNode } from "react";
import type { LinksFunction, LoaderFunctionArgs } from "react-router";

import { AppRoot, Document } from "@sneakers-web/shell";
import { rootLoader } from "@sneakers-web/shell/server";

import appCss from "@/app.css?url";
import { SetupGate } from "@/frame/SetupGate";

export const loader = (arguments_: LoaderFunctionArgs) => rootLoader(arguments_);

export const links: LinksFunction = () => [
  { href: appCss, rel: "stylesheet" },
  { href: `${import.meta.env.BASE_URL}favicon.svg`, rel: "icon", type: "image/svg+xml" },
  { href: `${import.meta.env.BASE_URL}app-icon.svg`, rel: "apple-touch-icon" },
];

export const Layout = ({ children }: { children: ReactNode }) => <Document>{children}</Document>;

export const meta = () => [{ title: "Sneakers-PAM admin console" }];

const Root = () => <AppRoot whenNotSetUp={<SetupGate />} />;

export default Root;

export { RouteError as ErrorBoundary } from "@sneakers-web/shell";
