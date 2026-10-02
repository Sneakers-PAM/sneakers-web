import { GatewayClient } from "@sneakers-web/api-client";
import { edge } from "@sneakers-web/edge.server";

const clients = new WeakMap<Request, GatewayClient>();

/**
 * The gateway client for one incoming request: the browser's session cookie goes along,
 * nothing else. Loaders and actions on the same request share one client, so the CSRF
 * token read by the session check is reused.
 */
export const gatewayFor = (request: Request): GatewayClient => {
  let gw = clients.get(request);
  if (!gw) {
    gw = new GatewayClient({
      baseUrl: edge.gatewayUrl,
      cookieHeader: request.headers.get("Cookie"),
      sessionCookie: edge.sessionCookie,
    });
    clients.set(request, gw);
  }
  return gw;
};

/** Response headers that pass the gateway's Set-Cookie answers back to the browser. */
export const relayCookies = (gw: GatewayClient, init?: HeadersInit): Headers => {
  const headers = new Headers(init);
  for (const c of gw.setCookies) headers.append("Set-Cookie", c);
  return headers;
};
