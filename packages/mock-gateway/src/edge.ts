import type { Edge } from "@sneakers-web/api-client";

import { MOCK_MARKER } from "#mock/marker";

/** The banner every shell shows while it runs against the mock gateway. */
export const MOCK_BANNER = "MOCK DATA, not a real server";

/**
 * The mock edge: a service worker answers the gateway's routes from invented fixtures.
 * Only builds made with `--mode mock` get this module, through the `@sneakers-web/edge`
 * alias; no app code imports it.
 */
export const edge: Edge = {
  banner: MOCK_BANNER,
  mode: "mock",
  start: async () => {
    const [{ setupWorker }, { handlers }] = await Promise.all([
      import("msw/browser"),
      import("#mock/handlers"),
    ]);
    const worker = setupWorker(...handlers);
    await worker.start({
      onUnhandledRequest(request, print) {
        const url = new URL(request.url);
        if (url.origin !== location.origin) return print.error();
        if (/\.(js|css|woff2?|svg|png|ico|map|json)$/.test(url.pathname)) return;
        if (url.pathname.startsWith("/@") || url.pathname.startsWith("/node_modules/")) return;
        if (url.pathname.endsWith("config.js")) return;
        print.error();
      },
      quiet: true,
      serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
    });
    console.info(`[mock] ${MOCK_MARKER}: answering from fixtures`);
  },
  storagePrefix: "mock:",
};
