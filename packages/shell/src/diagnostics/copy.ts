import { createLogger } from "@sneakers-web/api-client";
import { toast } from "@sneakers-web/ui";

import { currentRoute } from "#shell/diagnostics/problems";
import { buildReport, type DiagnosticsData, type Problem } from "#shell/diagnostics/report";

const log = createLogger("diagnostics");

/** The resource route every app serves the diagnostics at (base-free; useHref adds /admin/). */
export const DIAGNOSTICS_ROUTE = "/resources/diagnostics";

/** The app server's diagnostics, or null when it can't be reached. */
export const loadDiagnostics = async (url: string): Promise<DiagnosticsData | null> => {
  try {
    const response = await fetch(url, {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    return (await response.json()) as DiagnosticsData;
  } catch {
    return null;
  }
};

const fallback: DiagnosticsData = {
  app: { commit: __APP_COMMIT__, name: "unknown", version: __APP_VERSION__ },
  gateway: null,
};

/** Build the report for `problem` and put it on the clipboard. Returns the copied text. */
export const copyDiagnostics = async ({
  problem,
  route,
  url,
}: {
  problem?: Problem;
  route?: string;
  url: string;
}): Promise<string> => {
  const data = (await loadDiagnostics(url)) ?? fallback;
  const { text } = buildReport({
    data,
    now: new Date(),
    problem,
    route: route ?? currentRoute(),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    url: globalThis.location.href,
    userAgent: navigator.userAgent,
  });
  await navigator.clipboard.writeText(text);
  log.info("diagnostics copied", { gateway: data.gateway !== null });
  return text;
};

/** copyDiagnostics (or an app's own copier), then a toast saying whether it worked. */
export const copyWithNotice = async (
  options: Parameters<typeof copyDiagnostics>[0],
  copy: (options: Parameters<typeof copyDiagnostics>[0]) => Promise<string> = copyDiagnostics,
) => {
  try {
    await copy(options);
    toast("Diagnostics copied. Paste them into your support request.");
  } catch {
    toast("Couldn't copy. Open About and diagnostics in the account menu to see them.");
  }
};
