import { createLogger } from "@sneakers-web/api-client";

import { scrub } from "#shell/diagnostics/report";
import {
  type IssueCopyError,
  type IssueCopyErrorSource,
  MAX_ERRORS,
} from "#shell/issueCopy/bundle";
import { shortSelector } from "#shell/issueCopy/selector";
import { easternIso } from "#shell/issueCopy/time";

const log = createLogger("issue-copy");
const MAX_MESSAGE = 200;

let ring: IssueCopyError[] = [];
let clicked: string | undefined;
let uninstall: (() => void) | null = null;

/** Keep `message` as the newest entry for `source`, redacted the same way as the logger, capped at MAX_ERRORS. */
export const recordIssueCopyError = (source: IssueCopyErrorSource, message: string): void => {
  const m = scrub(message).slice(0, MAX_MESSAGE);
  ring = [{ at: easternIso(new Date()), m, src: source }, ...ring].slice(0, MAX_ERRORS);
};

/** The ring buffer, newest first. */
export const issueCopyErrors = (): readonly IssueCopyError[] => ring;

export const noteIssueCopyClick = (element: Element | null): void => {
  clicked = element ? shortSelector(element) : undefined;
};

/** The last clicked element's name, for the bundle's `clicked` key. */
export const lastIssueCopyClick = (): string | undefined => clicked;

const onWindowError = (event: ErrorEvent): void => recordIssueCopyError("window", event.message);

const onUnhandledRejection = (event: PromiseRejectionEvent): void =>
  recordIssueCopyError(
    "promise",
    event.reason instanceof Error ? event.reason.message : String(event.reason),
  );

const onDocumentClick = (event: MouseEvent): void =>
  noteIssueCopyClick(event.target instanceof Element ? event.target : null);

/**
 * Install the window, unhandled-rejection, fetch-failure and click listeners once, returning
 * a function that removes them. Called only while the dev UI issue copy is on (both the build
 * flag and the server's SNEAKERS_DEV_UI_ISSUE_COPY): a release build never reaches this, and
 * `check:no-mock` proves the live build has none of it.
 */
export const installIssueCopyCapture = (): (() => void) => {
  if (uninstall) return uninstall;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (...parameters: Parameters<typeof fetch>) => {
    try {
      return await originalFetch(...parameters);
    } catch (error) {
      recordIssueCopyError("fetch", error instanceof Error ? error.message : String(error));
      throw error;
    }
  }) as typeof fetch;
  globalThis.addEventListener("error", onWindowError);
  globalThis.addEventListener("unhandledrejection", onUnhandledRejection);
  document.addEventListener("click", onDocumentClick, true);
  log.debug("issue copy capture installed");
  uninstall = () => {
    globalThis.removeEventListener("error", onWindowError);
    globalThis.removeEventListener("unhandledrejection", onUnhandledRejection);
    document.removeEventListener("click", onDocumentClick, true);
    globalThis.fetch = originalFetch;
    uninstall = null;
  };
  return uninstall;
};

/** For tests. */
export const resetIssueCopyCapture = (): void => {
  ring = [];
  clicked = undefined;
  uninstall?.();
};
