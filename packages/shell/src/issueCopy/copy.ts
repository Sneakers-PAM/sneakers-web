import { createLogger } from "@sneakers-web/api-client";
import { toast } from "@sneakers-web/ui";

import { issueCopyLine } from "#shell/issueCopy/bundle";
import { issueCopyErrors, lastIssueCopyClick } from "#shell/issueCopy/errorBuffer";

const log = createLogger("issue-copy");

export interface IssueCopyContext {
  app: string;
  params?: Readonly<Record<string, string>>;
  path?: string;
  role?: string;
  route?: string;
  theme?: string;
}

/** Build the schema v1 bundle for the current screen and put it on the clipboard. */
export const copyIssueBundle = async (context: IssueCopyContext): Promise<string> => {
  const line = issueCopyLine({
    ...context,
    clicked: lastIssueCopyClick(),
    dpr: globalThis.devicePixelRatio || 1,
    errors: issueCopyErrors(),
    locale: navigator.language,
    now: new Date(),
    sha: __APP_COMMIT__,
    ua: navigator.userAgent,
    vh: globalThis.innerHeight,
    vw: globalThis.innerWidth,
  });
  await navigator.clipboard.writeText(line);
  log.info("UI issue bundle copied");
  return line;
};

/** copyIssueBundle, then a toast saying whether it worked. */
export const copyIssueBundleWithNotice = async (context: IssueCopyContext): Promise<void> => {
  try {
    await copyIssueBundle(context);
    toast("Copied for a UI issue. Paste it where you're reporting the problem.");
  } catch {
    toast("Couldn't copy the UI issue bundle.");
  }
};
