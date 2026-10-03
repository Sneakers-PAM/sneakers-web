import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { Button, EmptyState, PageHeader } from "@sneakers-web/ui";
import { Plus } from "lucide-react";
import { Link, useLoaderData, useLocation, useNavigation } from "react-router";

import { ListSkeleton } from "@/features/requests/ListSkeleton";
import { PageFailure } from "@/features/requests/PageFailure";
import { loadTargets, targetsAction } from "@/features/targets/targets.server";
import { TargetsTable } from "@/features/targets/TargetsTable";

export const loader = ({ request }: LoaderFunctionArgs) => loadTargets(request);

/** `delete` by `id`. */
export const action = ({ request }: ActionFunctionArgs) => targetsAction(request);

export const meta = () => [{ title: "Targets · Sneakers-PAM" }];

const LOADING = "targets-loading";

const Header = ({ canCreate }: { canCreate: boolean }) => (
  <PageHeader
    actions={
      canCreate ? (
        <Button asChild>
          <Link to="/targets/new">
            <Plus aria-hidden />
            New target
          </Link>
        </Button>
      ) : (
        <Button disabled title="An admin has to add a connection first">
          <Plus aria-hidden />
          New target
        </Button>
      )
    }
    eyebrow="Targets"
    subtitle="Systems your secrets check or rotate against. Shared targets are managed by admins."
    title="Targets"
  />
);

/** U-10: shared targets, read-only, and the user's own, which they manage here. */
const Targets = () => {
  const { canCreate, rows } = useLoaderData<typeof loader>();
  const location = useLocation();
  const navigation = useNavigation();
  const reloading =
    navigation.state === "loading" &&
    !navigation.formMethod &&
    navigation.location.pathname === location.pathname;
  return (
    <div className="flex flex-col gap-6">
      <Header canCreate={canCreate} />
      {reloading ? (
        <ListSkeleton rows={4} testId={LOADING} />
      ) : rows.length === 0 ? (
        <EmptyState
          body="Add a personal target to check or rotate your own secrets without an admin."
          title="No targets yet"
        />
      ) : (
        <TargetsTable rows={rows} />
      )}
    </div>
  );
};

export default Targets;

export const ErrorBoundary = () => (
  <div className="flex flex-col gap-6">
    <Header canCreate={false} />
    <PageFailure testId={LOADING} title="Targets didn't load" />
  </div>
);
