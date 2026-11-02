import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  ShouldRevalidateFunctionArgs,
} from "react-router";

import { RouteError, routeErrorRefusal } from "@sneakers-web/shell";
import { useLoaderData, useRouteError } from "react-router";

import { changeTypeAction, loadChangeType } from "@/features/editors/changeType.server";
import { ChangeTypePage } from "@/features/editors/ChangeTypePage";
import { EditorLoadFailed } from "@/features/editors/EditorStates";
import { SecretNotFound } from "@/features/secret/SecretStates";

export const loader = ({ params, request }: LoaderFunctionArgs) =>
  loadChangeType(request, params.id ?? "");

export const action = ({ params, request }: ActionFunctionArgs) =>
  changeTypeAction(request, params.id ?? "");

/**
 * The page's own posts never load its data again: a preview or a reveal changes nothing stored,
 * and after the change itself the page moves on to where it was opened from, or the next secret.
 */
export const shouldRevalidate = ({
  defaultShouldRevalidate,
  formMethod,
}: ShouldRevalidateFunctionArgs) => (formMethod ? false : defaultShouldRevalidate);

export const meta = ({ data }: { data?: Awaited<ReturnType<typeof loader>> }) => [
  { title: `${data?.ok ? `Change type of ${data.secret.name}` : "Change type"} · Sneakers-PAM` },
];

/** Change a secret's type, as a two-step workflow. */
const ChangeType = () => {
  const data = useLoaderData<typeof loader>();
  if (!data.ok) return <EditorLoadFailed failure={data.failure} title="Change type" />;
  // Keyed by id so one secret's line-up never carries over to the next in a selection.
  return <ChangeTypePage key={data.secret.id} page={data} />;
};

export const ErrorBoundary = () => {
  const refusal = routeErrorRefusal(useRouteError());
  if (refusal) return <SecretNotFound id={refusal.metadata.id} />;
  return <RouteError />;
};

export default ChangeType;
