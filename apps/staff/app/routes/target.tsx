import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { Button, EmptyState, PageHeader } from "@sneakers-web/ui";
import { useState } from "react";
import {
  isRouteErrorResponse,
  Link,
  useActionData,
  useLoaderData,
  useRevalidator,
  useRouteError,
} from "react-router";

import { ListSkeleton } from "@/features/requests/ListSkeleton";
import { TargetForm } from "@/features/targets/TargetForm";
import {
  loadTargetEditor,
  saveTargetAction,
  type TargetEditorData,
} from "@/features/targets/targets.server";

export const loader = ({ params, request }: LoaderFunctionArgs) =>
  loadTargetEditor(request, params.id);

export const action = ({ params, request }: ActionFunctionArgs) =>
  saveTargetAction(request, params.id);

export const meta = ({ data }: { data?: TargetEditorData }) => [
  { title: `${data?.draft.name || "New target"} · Targets · Sneakers-PAM` },
];

/** U-11: create a target, or change one the user owns (any target, for a site admin). */
const TargetEditor = () => {
  const data = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  // A new id remounts the form, so a draft never carries over to another target.
  return <TargetForm data={data} key={data.target?.id ?? "new"} result={result} />;
};

export default TargetEditor;

const LOADING = "target-loading";

const BackToTargets = () => (
  <Button asChild variant="secondary">
    <Link to="/targets">Back to targets</Link>
  </Button>
);

export const ErrorBoundary = () => {
  const error = useRouteError();
  const { revalidate, state } = useRevalidator();
  const [retrying, setRetrying] = useState(false);
  const status = isRouteErrorResponse(error) ? error.status : 0;
  if (retrying && state === "loading") return <ListSkeleton rows={4} testId={LOADING} />;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Targets" title="Target" />
      {status === 403 || status === 404 ? (
        <EmptyState
          action={<BackToTargets />}
          body={
            status === 403
              ? "Only its owner or a site admin can change this target."
              : "That target doesn't exist, or you can't see it."
          }
          loader={false}
          title={status === 403 ? "You can't change this target" : "No such target"}
        />
      ) : (
        <EmptyState
          action={
            <span className="flex gap-2.5">
              <Button
                onClick={() => {
                  setRetrying(true);
                  void revalidate();
                }}
                variant="secondary"
              >
                Retry
              </Button>
              <BackToTargets />
            </span>
          }
          body="The server didn't answer. Nothing was changed; try again in a moment."
          loader={false}
          title="The target didn't load"
        />
      )}
    </div>
  );
};
