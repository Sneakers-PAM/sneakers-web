import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { NotFoundScreen, RouteError } from "@sneakers-web/shell";
import { isRouteErrorResponse, useLoaderData, useRouteError } from "react-router";

import { breakGlassAction, loadBreakGlass } from "@/features/breakGlass/breakGlass.server";
import { BreakGlassPage } from "@/features/breakGlass/BreakGlassPage";

export const loader = ({ request }: LoaderFunctionArgs) => loadBreakGlass(request);

/** `open` a session with a reason and code; `reveal` a secret in it. */
export const action = ({ request }: ActionFunctionArgs) => breakGlassAction(request);

export const meta = () => [{ title: "Break the glass · Sneakers-PAM" }];

const BreakGlass = () => <BreakGlassPage view={useLoaderData<typeof loader>()} />;

export default BreakGlass;

export const ErrorBoundary = () => {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundScreen />;
  return <RouteError />;
};
