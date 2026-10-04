import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { RouteError } from "@sneakers-web/shell";
import { useLoaderData, useLocation, useNavigation, useRouteError } from "react-router";

import { EditorPage } from "@/features/editors/EditorPage";
import { editorAction, loadNewSecret } from "@/features/editors/editors.server";
import { EditorLoadFailed, EditorSkeleton, NoFolders } from "@/features/editors/EditorStates";

export const loader = ({ request }: LoaderFunctionArgs) => loadNewSecret(request);

export const action = ({ request }: ActionFunctionArgs) => editorAction(request);

export const meta = () => [{ title: "New secret · Sneakers-PAM" }];

/** U-05: a new secret, in the folder `?folder=<id>` names when the person may add to it. */
const NewSecret = () => {
  const data = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const location = useLocation();
  const next = navigation.state === "loading" ? navigation.location : null;
  if (next?.pathname === location.pathname && next.search !== location.search)
    return <EditorSkeleton />;
  if (!data.ok) return <EditorLoadFailed failure={data.failure} title="New secret" />;
  if (data.folders.length === 0) return <NoFolders />;
  // Keyed by the address so a different ?folder= starts a fresh form.
  return <EditorPage key={location.search} page={data} />;
};

export const ErrorBoundary = () => {
  useRouteError();
  return <RouteError />;
};

export default NewSecret;
