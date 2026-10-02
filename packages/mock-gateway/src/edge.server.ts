import type { Edge } from "@sneakers-web/api-client";

import { MOCK_MARKER } from "#mock/marker";
import { MOCK_GATEWAY_URL, MOCK_SESSION_COOKIE, SSO_PENDING_ID } from "#mock/state";

/** The banner every screen shows while the app runs against the mock gateway. */
export const MOCK_BANNER = "MOCK DATA, not a real server";

/**
 * The mock edge: the app server's calls to the gateway are answered in-process from
 * invented fixtures (MSW in Node). Only builds made with `--mode mock` get this module,
 * through the `@sneakers-web/edge.server` alias; no app code imports it.
 */
export const edge: Edge = {
  banner: MOCK_BANNER,
  cookiePrefix: "mock_",
  gatewayUrl: MOCK_GATEWAY_URL,
  mode: "mock",
  sessionCookie: MOCK_SESSION_COOKIE,
  ssoStart: (origin, base) =>
    `${origin}${base}sign-in?sso_pending=${SSO_PENDING_ID}&factors=totp,email`,
  start: async () => {
    const [{ setupServer }, { handlers }] = await Promise.all([
      import("msw/node"),
      import("#mock/handlers"),
    ]);
    setupServer(...handlers).listen({ onUnhandledFrame: "bypass" });
    console.info(`[mock] ${MOCK_MARKER}: gateway calls are answered from fixtures`);
  },
  storagePrefix: "mock:",
};
