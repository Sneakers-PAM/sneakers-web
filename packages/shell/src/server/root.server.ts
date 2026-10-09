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

/**
 * Whether the dev-only UI issue copy item is on: the build flag is a literal, so a release
 * build drops this whole check (and the server variable's name with it), the same way the
 * dev quick login's build does.
 */
const developmentUiIssueCopy = (): boolean =>
  import.meta.env.SNEAKERS_DEV_UI_ISSUE_COPY_BUILD === "true" &&
  process.env.SNEAKERS_DEV_UI_ISSUE_COPY === "true";

export interface RootData {
  /** The persistent banner (mock builds), or null. */
  banner: null | string;
  /** Load the appliance's box-state poller: only on the appliance (`APPLIANCE_BOX_POLLER=true`). */
  boxPoller: boolean;
  config: PublicConfig;
  /** The dev-only UI issue copy item's gate; see `developmentUiIssueCopy` above. */
  developmentUiIssueCopy: boolean;
  display: DisplaySettings;
  needsSetup: boolean;
  storagePrefix: string;
}

/** What every page needs: the public settings, the saved display choice and the edge banner. */
export const rootLoader = async ({ request }: LoaderFunctionArgs): Promise<RootData> => ({
  banner: edge.banner,
  boxPoller: process.env.APPLIANCE_BOX_POLLER === "true",
  config: publicConfigFrom(process.env, __APP_VERSION__),
  developmentUiIssueCopy: developmentUiIssueCopy(),
  display: parseDisplay(readCookie(request.headers.get("Cookie"), displayCookie())),
  needsSetup: await needsSetup(request),
  storagePrefix: edge.storagePrefix,
});
