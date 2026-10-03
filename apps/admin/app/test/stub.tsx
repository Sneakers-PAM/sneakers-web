import { sessionCookie, withCookie } from "@sneakers-web/mock-gateway/testing";
import { Toaster, TooltipProvider } from "@sneakers-web/ui";
import { render } from "@testing-library/react";
import { createRoutesStub, Outlet } from "react-router";

import { loader as frameLoader } from "@/routes/frame";

/** A route module as the tests mount it: the page, its loader and action. */
export interface RouteModule {
  action?: unknown;
  default: React.ComponentType;
  ErrorBoundary?: React.ComponentType;
  loader?: unknown;
}

/**
 * Render admin routes as `userId` sees them: the real loaders and actions run against the
 * mock gateway, under a frame route that loads the signed-in user like the console does.
 */
export const renderAdmin = (
  routes: { module: RouteModule; path: string }[],
  start: string,
  userId = "mock-user-alice",
) => {
  const cookie = sessionCookie(userId);
  const wrap = (function_: unknown) =>
    function_ ? (withCookie(cookie, function_ as never) as never) : undefined;
  const Stub = createRoutesStub([
    {
      children: routes.map(({ module, path }) => ({
        action: wrap(module.action),
        Component: module.default,
        ErrorBoundary: module.ErrorBoundary,
        HydrateFallback: () => null,
        loader: wrap(module.loader),
        path,
      })),
      Component: () => <Outlet />,
      HydrateFallback: () => null,
      id: "routes/frame",
      loader: wrap(frameLoader),
    },
  ]);
  return render(
    <TooltipProvider>
      <Stub initialEntries={[start]} />
      <Toaster />
    </TooltipProvider>,
  );
};
