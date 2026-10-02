import type { Edge } from "#api/edge/types";

/**
 * The live edge: the app server calls the real gateway at GATEWAY_URL (in a cluster, the
 * gateway's service; next to it on the same host, the browser reaches the gateway's own
 * routes such as single sign-on).
 */
export const edge: Edge = {
  banner: null,
  cookiePrefix: "",
  gatewayUrl: process.env.GATEWAY_URL || "http://localhost:9100",
  mode: "live",
  sessionCookie: "sneakers_sid",
  ssoStart: (origin) => `${origin}/auth/sso/login`,
  start: async () => {},
  storagePrefix: "",
};
