import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { Button, EmptyState, PageHeader, toast } from "@sneakers-web/ui";
import { Plus } from "lucide-react";
import { useCallback, useState } from "react";
import { useLoaderData, useLocation, useNavigation } from "react-router";

import { grantsAction, loadGrants } from "@/features/agents/agents.server";
import { AgentTabs } from "@/features/agents/AgentTabs";
import { GrantForm } from "@/features/agents/GrantForm";
import { GrantsTable } from "@/features/agents/GrantsTable";
import { ListSkeleton, PageFailure } from "@/features/agents/PageStates";

export const loader = ({ request }: LoaderFunctionArgs) => loadGrants(request);

/** `create` (with the factor) and `revoke` by `id`, plus `factor-email` and `factor-passkey`. */
export const action = ({ request }: ActionFunctionArgs) => grantsAction(request);

export const meta = () => [{ title: "Use grants · Sneakers-PAM" }];

const LOADING = "grants-loading";

const Header = ({ actions }: { actions?: React.ReactNode }) => (
  <div className="flex flex-col gap-4">
    <AgentTabs />
    <PageHeader
      actions={actions}
      eyebrow="Agents & tokens"
      subtitle="A grant lets a token use chosen secrets in chosen programs without asking, for up to 24 hours. Revoke it when you're done."
      title="Use grants"
    />
  </div>
);

/** U-15 use grants. */
const Grants = () => {
  const { folders, grants, secrets, tokens } = useLoaderData<typeof loader>();
  const location = useLocation();
  const navigation = useNavigation();
  const [open, setOpen] = useState(false);
  const reloading =
    navigation.state === "loading" &&
    !navigation.formMethod &&
    navigation.location.pathname === location.pathname;
  const created = useCallback((done: string) => {
    setOpen(false);
    toast(done);
  }, []);
  const noTokens = tokens.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <Header
        actions={
          !open && (
            <Button disabled={noTokens} onClick={() => setOpen(true)}>
              <Plus aria-hidden />
              New grant
            </Button>
          )
        }
      />
      {noTokens && (
        <span className="text-[0.875rem] text-muted">
          You need an active personal token to create a grant. Connect an agent first, under My
          tokens.
        </span>
      )}
      {open && (
        <GrantForm
          folders={folders}
          onClose={() => setOpen(false)}
          onCreated={created}
          secrets={secrets}
          tokens={tokens}
        />
      )}
      {reloading ? (
        <ListSkeleton testId={LOADING} />
      ) : grants.length === 0 ? (
        <EmptyState
          body="Without a grant, every use waits for you in Approvals."
          title="No use grants"
        />
      ) : (
        <GrantsTable grants={grants} />
      )}
    </div>
  );
};

export default Grants;

export const ErrorBoundary = () => (
  <div className="flex flex-col gap-6">
    <Header />
    <PageFailure testId={LOADING} title="Use grants didn't load" />
  </div>
);
