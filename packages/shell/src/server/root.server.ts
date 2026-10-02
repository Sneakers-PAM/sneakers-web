import type { LoaderFunctionArgs } from "react-router";

import {
  type PublicConfig,
  publicConfigFrom,
  readCookie,
  setLogFormat,
  setLogLevel,
} from "@sneakers-web/api-client";
import { edge } from "@sneakers-web/edge.server";
import { type DisplaySettings, parseDisplay } from "@sneakers-web/ui";

import { needsSetup } from "#shell/server/session.server";

if (process.env.LOG_FORMAT === "console") setLogFormat("console");
if (process.env.LOG_LEVEL) setLogLevel(process.env.LOG_LEVEL as PublicConfig["logLevel"]);

/** The cookie the display settings live in. Mock builds use their own name. */
export const displayCookie = (): string => `${edge.cookiePrefix}sneakers_display`;

export interface RootData {
  /** The persistent banner (mock builds), or null. */
  banner: null | string;
  config: PublicConfig;
  display: DisplaySettings;
  needsSetup: boolean;
  storagePrefix: string;
}

/** What every page needs: the public settings, the saved display choice and the edge banner. */
export const rootLoader = async ({ request }: LoaderFunctionArgs): Promise<RootData> => ({
  banner: edge.banner,
  config: publicConfigFrom(process.env, __APP_VERSION__),
  display: parseDisplay(readCookie(request.headers.get("Cookie"), displayCookie())),
  needsSetup: await needsSetup(request),
  storagePrefix: edge.storagePrefix,
});
