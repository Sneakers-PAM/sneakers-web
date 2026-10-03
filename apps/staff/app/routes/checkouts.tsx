import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { EmptyState, PageHeader } from "@sneakers-web/ui";
import { useLoaderData, useLocation, useNavigation } from "react-router";

import { checkoutsAction, loadCheckouts } from "@/features/requests/checkouts.server";
import { CheckoutsTable } from "@/features/requests/CheckoutsTable";
import { ListSkeleton } from "@/features/requests/ListSkeleton";
import { PageFailure } from "@/features/requests/PageFailure";

export const loader = ({ request }: LoaderFunctionArgs) => loadCheckouts(request);

/** `checkin` and `checkout` by `secretId`; other pages post here with a fetcher. */
export const action = ({ request }: ActionFunctionArgs) => checkoutsAction(request);

export const meta = () => [{ title: "Checkouts · Sneakers-PAM" }];

const LOADING = "checkouts-loading";

const Header = () => (
  <PageHeader
    eyebrow="Checkouts"
    subtitle="Privileged secrets you hold now. Check in when done; each one rotates."
    title="Your checkouts"
  />
);

/** U-08 checkouts. */
const Checkouts = () => {
  const { checkouts } = useLoaderData<typeof loader>();
  const location = useLocation();
  const navigation = useNavigation();
  const reloading =
    navigation.state === "loading" &&
    !navigation.formMethod &&
    navigation.location.pathname === location.pathname &&
    navigation.location.search === location.search;
  return (
    <div className="flex flex-col gap-6">
      <Header />
      {reloading ? (
        <ListSkeleton testId={LOADING} />
      ) : checkouts.length === 0 ? (
        <EmptyState
          body="Check out a privileged secret from its page."
          title="No active checkouts"
        />
      ) : (
        <CheckoutsTable checkouts={checkouts} />
      )}
    </div>
  );
};

export default Checkouts;

export const ErrorBoundary = () => (
  <div className="flex flex-col gap-6">
    <Header />
    <PageFailure testId={LOADING} title="Checkouts didn't load" />
  </div>
);
