import type { Connect, Plugin } from "vite";

/**
 * Build-time helpers for mock mode, used only by the Vite config of a mock build.
 *
 * A service worker can't answer page navigations, so the one gateway route the browser
 * navigates to (single sign-on) is answered here: it sends the browser back to the app
 * with a second-factor challenge, the way the real SSO callback does.
 */
export const mockNavigationPlugin = (): Plugin => {
  const handle: Connect.NextHandleFunction = (request, res, next) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (url.pathname !== "/auth/sso/login") return next();
    const referer = request.headers.referer ? new URL(request.headers.referer).pathname : "/";
    const base = referer.startsWith("/admin/") ? "/admin/" : "/";
    res.statusCode = 302;
    res.setHeader("Location", `${base}?sso_pending=mock-pending-sso&factors=totp,email`);
    res.end();
  };
  return {
    configurePreviewServer(server) {
      server.middlewares.use(handle);
    },
    configureServer(server) {
      server.middlewares.use(handle);
    },
    name: "sneakers-mock-navigation",
  };
};
