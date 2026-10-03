import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { RouteError } from "@sneakers-web/shell";
import {
  isRouteErrorResponse,
  useLoaderData,
  useLocation,
  useNavigation,
  useRouteError,
} from "react-router";

import { loadSecret, secretAction } from "@/features/secret/secret.server";
import { SecretPage } from "@/features/secret/SecretPage";
import { SecretLoadFailed, SecretNotFound, SecretSkeleton } from "@/features/secret/SecretStates";

export const loader = ({ params, request }: LoaderFunctionArgs) =>
  loadSecret(request, params.id ?? "");

export const action = ({ params, request }: ActionFunctionArgs) =>
  secretAction(request, params.id ?? "");

export const meta = ({ data }: { data?: Awaited<ReturnType<typeof loader>> }) => [
  { title: `${data?.ok ? data.secret.name : "Secret"} · Sneakers-PAM` },
];

/** U-04: the secret detail page. */
const SecretDetail = () => {
  const data = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const location = useLocation();
  const leaving = navigation.state === "loading" ? navigation.location.pathname : null;
  if (leaving?.startsWith("/secret/") && leaving !== location.pathname) return <SecretSkeleton />;
  if (!data.ok) return <SecretLoadFailed failure={data.failure} />;
  // Keyed by id so revealed values never carry over from one secret to the next.
  return <SecretPage key={data.secret.id} page={data} />;
};

export const ErrorBoundary = () => {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <SecretNotFound />;
  return <RouteError />;
};

export default SecretDetail;
