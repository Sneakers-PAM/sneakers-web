import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { useQuietRefresh } from "@sneakers-web/shell";
import { EmptyState, PageHeader, Pill } from "@sneakers-web/ui";
import { useLoaderData, useLocation, useNavigation } from "react-router";

import { approvalsAction, loadApprovals } from "@/features/agents/agents.server";
import { AgentTabs } from "@/features/agents/AgentTabs";
import { ApprovalsTable } from "@/features/agents/ApprovalsTable";
import { ListSkeleton, PageFailure } from "@/features/agents/PageStates";

export const loader = ({ request }: LoaderFunctionArgs) => loadApprovals(request);

/** `approve` (with the factor) and `deny` by `id`, plus `factor-email` and `factor-passkey`. */
export const action = ({ request }: ActionFunctionArgs) => approvalsAction(request);

export const meta = () => [{ title: "Agent approvals · Sneakers-PAM" }];

// Agents wait on this page, so it checks for new requests more often than the frame does.
const REFRESH_MS = 5000;
const LOADING = "approvals-loading";

const Header = ({ waiting }: { waiting?: number }) => (
  <div className="flex flex-col gap-4">
    <AgentTabs />
    <PageHeader
      actions={
        waiting ? (
          <Pill tone="primary">{waiting} waiting · agents pause until you decide</Pill>
        ) : undefined
      }
      eyebrow="Agents & tokens"
      subtitle="Approve only commands you started. The value goes to that command once and is never shown to the app."
      title="Approvals"
    />
  </div>
);

/** U-14 agent approvals. */
const Approvals = () => {
  const { uses } = useLoaderData<typeof loader>();
  const location = useLocation();
  const navigation = useNavigation();
  useQuietRefresh(REFRESH_MS);
  const reloading =
    navigation.state === "loading" &&
    !navigation.formMethod &&
    navigation.location.pathname === location.pathname &&
    navigation.location.search === location.search;
  return (
    <div className="flex flex-col gap-6">
      <Header waiting={uses.length} />
      {reloading ? (
        <ListSkeleton testId={LOADING} />
      ) : uses.length === 0 ? (
        <EmptyState
          body="New requests from your agents appear here and in the header badge."
          title="Nothing waiting"
        />
      ) : (
        <ApprovalsTable uses={uses} />
      )}
      <span className="text-small text-muted">
        Requests expire after 10 minutes, and the agent is told it was refused.
      </span>
    </div>
  );
};

export default Approvals;

export const ErrorBoundary = () => (
  <div className="flex flex-col gap-6">
    <Header />
    <PageFailure testId={LOADING} title="Approvals didn't load" />
  </div>
);
