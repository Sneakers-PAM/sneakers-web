import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { Button, EmptyState } from "@sneakers-web/ui";
import { useState } from "react";
import { useLoaderData, useLocation, useNavigation, useRevalidator } from "react-router";

import { loadRun, runAction } from "@/features/agents/run.server";
import { RunApproval, RunFrame, RunLoading } from "@/features/agents/RunApproval";

export const loader = ({ params, request }: LoaderFunctionArgs) =>
  loadRun(request, params.runId ?? "");

/** `approve` (with the factor unless the session's window is open) and `deny` the ticked `ids`, plus `factor-email` and `factor-passkey`. */
export const action = ({ params, request }: ActionFunctionArgs) =>
  runAction(request, params.runId ?? "");

export const meta = () => [{ title: "Approve agent requests · Sneakers-PAM" }];

/** U-14b: the page an agent's approval link opens, outside the frame. */
const ApprovalRun = () => {
  const data = useLoaderData<typeof loader>();
  const location = useLocation();
  const navigation = useNavigation();
  // A different run (or a first load) shows the spinner; the quiet refresh never does.
  if (
    navigation.state === "loading" &&
    !navigation.formMethod &&
    navigation.location.pathname !== location.pathname
  ) {
    return <RunLoading />;
  }
  // A new run id starts fresh: no ticks or answers carried over from another run.
  return <RunApproval data={data} key={data.runId} />;
};

export default ApprovalRun;

export const ErrorBoundary = () => {
  const { revalidate, state } = useRevalidator();
  const [retrying, setRetrying] = useState(false);
  if (retrying && state === "loading") return <RunLoading />;
  return (
    <RunFrame>
      <EmptyState
        action={
          <Button
            onClick={() => {
              setRetrying(true);
              void revalidate();
            }}
            variant="secondary"
          >
            Retry
          </Button>
        }
        body="The server didn't answer. The agent is still waiting; try again in a moment."
        loader={false}
        title="These requests didn't load"
      />
    </RunFrame>
  );
};
