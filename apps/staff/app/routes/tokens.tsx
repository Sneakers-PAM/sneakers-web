import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { EmptyState, PageHeader } from "@sneakers-web/ui";
import { useLoaderData, useLocation, useNavigation } from "react-router";

import { loadTokens, tokensAction } from "@/features/agents/agents.server";
import { AgentTabs } from "@/features/agents/AgentTabs";
import { ConnectAgent } from "@/features/agents/ConnectAgent";
import { ListSkeleton, PageFailure } from "@/features/agents/PageStates";
import { TokensTable } from "@/features/agents/TokensTable";

export const loader = ({ request }: LoaderFunctionArgs) => loadTokens(request);

/** `revoke` by `id`. */
export const action = ({ request }: ActionFunctionArgs) => tokensAction(request);

export const meta = () => [{ title: "My tokens · Sneakers-PAM" }];

const LOADING = "tokens-loading";

const Header = () => (
  <div className="flex flex-col gap-4">
    <AgentTabs />
    <PageHeader
      eyebrow="Agents & tokens"
      subtitle="Personal tokens let an app act as you with your current access. They never expire on their own; revoke any you no longer use."
      title="My tokens"
    />
  </div>
);

/** U-13 my tokens. */
const Tokens = () => {
  const { mcpUrl, tokens } = useLoaderData<typeof loader>();
  const location = useLocation();
  const navigation = useNavigation();
  const reloading =
    navigation.state === "loading" &&
    !navigation.formMethod &&
    navigation.location.pathname === location.pathname;
  return (
    <div className="flex flex-col gap-6">
      <Header />
      <div className="grid items-start gap-6 desktop:grid-cols-[minmax(0,1fr)_22rem]">
        {reloading ? (
          <ListSkeleton testId={LOADING} />
        ) : tokens.length === 0 ? (
          <EmptyState
            body="Connect an agent and its token shows up here."
            title="No personal tokens yet"
          />
        ) : (
          <TokensTable tokens={tokens} />
        )}
        <ConnectAgent mcpUrl={mcpUrl} />
      </div>
    </div>
  );
};

export default Tokens;

export const ErrorBoundary = () => (
  <div className="flex flex-col gap-6">
    <Header />
    <PageFailure testId={LOADING} title="Tokens didn't load" />
  </div>
);
