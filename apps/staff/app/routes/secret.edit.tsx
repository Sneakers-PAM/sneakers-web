import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { RouteError } from "@sneakers-web/shell";
import {
  isRouteErrorResponse,
  useLoaderData,
  useLocation,
  useNavigation,
  useRouteError,
} from "react-router";

import { EditorPage } from "@/features/editors/EditorPage";
import { editorAction, loadEditSecret } from "@/features/editors/editors.server";
import { EditorLoadFailed, EditorSkeleton } from "@/features/editors/EditorStates";
import { SecretNotFound } from "@/features/secret/SecretStates";

export const loader = ({ params, request }: LoaderFunctionArgs) =>
  loadEditSecret(request, params.id ?? "");

export const action = ({ params, request }: ActionFunctionArgs) =>
  editorAction(request, params.id ?? "");

export const meta = ({ data }: { data?: Awaited<ReturnType<typeof loader>> }) => [
  { title: `${data?.ok ? `Edit ${data.draft.name}` : "Edit secret"} · Sneakers-PAM` },
];

/** U-05: edit a secret. Sensitive values aren't filled in; a blank one keeps what's stored. */
const EditSecret = () => {
  const data = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const location = useLocation();
  const leaving = navigation.state === "loading" ? navigation.location.pathname : null;
  if (leaving?.endsWith("/edit") && leaving !== location.pathname) return <EditorSkeleton />;
  if (!data.ok) return <EditorLoadFailed failure={data.failure} title="Edit secret" />;
  // Keyed by id so one secret's draft never carries over to the next.
  return <EditorPage key={data.secretId} page={data} />;
};

export const ErrorBoundary = () => {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <SecretNotFound />;
  return <RouteError />;
};

export default EditSecret;
