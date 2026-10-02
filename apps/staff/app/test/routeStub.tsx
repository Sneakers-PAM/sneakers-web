import type { ComponentType } from "react";

import { sessionCookie, withCookie } from "@sneakers-web/mock-gateway/testing";
import { render } from "@testing-library/react";
import {
  type ActionFunctionArgs,
  createRoutesStub,
  type LoaderFunctionArgs,
  Outlet,
} from "react-router";

import { loader as frameLoader } from "@/routes/frame";

export interface StubRoute {
  action?: (arguments_: ActionFunctionArgs) => unknown;
  children?: StubRoute[];
  Component?: ComponentType;
  id?: string;
  loader?: (arguments_: LoaderFunctionArgs) => unknown;
  path?: string;
}

const signed = (cookie: string, r: StubRoute): object => ({
  ...r,
  action: r.action && withCookie(cookie, r.action),
  children: r.children?.map((c) => signed(cookie, c)),
  HydrateFallback: () => null,
  loader: r.loader && withCookie(cookie, r.loader),
});

/**
 * Render staff pages at `url` against the mock gateway, signed in as `user` (Alice unless
 * told otherwise). The pages sit under the real frame loader, as route "routes/frame", so
 * `useRouteLoaderData("routes/frame")` works; the frame's chrome isn't drawn. Call it inside
 * a test, after `withMockGateway()` has reset the mock state.
 */
export const renderRoute = (
  url: string,
  routes: StubRoute | StubRoute[],
  { user = "mock-user-alice" }: { user?: string } = {},
) => {
  const cookie = sessionCookie(user);
  const Stub = createRoutesStub([
    signed(cookie, {
      children: [routes].flat(),
      Component: Outlet,
      id: "routes/frame",
      loader: frameLoader,
    }) as never,
  ]);
  return render(<Stub initialEntries={[url]} />);
};
