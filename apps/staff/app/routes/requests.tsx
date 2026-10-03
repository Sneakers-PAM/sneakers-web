import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { PageHeader, useBreakpoint } from "@sneakers-web/ui";
import { useCallback, useState } from "react";
import { useLoaderData, useLocation, useNavigate, useNavigation } from "react-router";

import { ListSkeleton } from "@/features/requests/ListSkeleton";
import { PageFailure } from "@/features/requests/PageFailure";
import { PhoneRequests } from "@/features/requests/PhoneRequests";
import { RequestAccessDialog } from "@/features/requests/RequestAccessDialog";
import { loadRequests, requestsAction } from "@/features/requests/requests.server";
import { RequestTables } from "@/features/requests/RequestTables";
import { ReviewDialog } from "@/features/requests/ReviewDialog";

export const loader = ({ request }: LoaderFunctionArgs) => loadRequests(request);

export const action = ({ request }: ActionFunctionArgs) => requestsAction(request);

export const meta = () => [{ title: "Requests · Sneakers-PAM" }];

const LOADING = "requests-loading";

/** U-09 requests, with D-15 (review) and the request-access form from `?new=<secretId>`. */
const Requests = () => {
  const d = useLoaderData<typeof loader>();
  const phone = useBreakpoint() === "phone";
  const location = useLocation();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const [openId, setOpenId] = useState<null | string>(null);
  const close = useCallback(() => setOpenId(null), []);
  const closeAsk = useCallback(
    () => void navigate("/requests", { preventScrollReset: true, replace: true }),
    [navigate],
  );

  // Reloading this same page (the nav item again) shows the skeleton; quiet refreshes don't.
  const reloading =
    navigation.state === "loading" &&
    !navigation.formMethod &&
    navigation.location.pathname === location.pathname &&
    navigation.location.search === location.search;

  const row = [...d.awaiting, ...d.open, ...d.history].find((r) => r.id === openId);
  const lists = {
    approver: d.approver,
    awaiting: d.awaiting,
    history: d.history,
    onOpen: setOpenId,
    open: d.open,
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Requests"
        subtitle={
          d.approver
            ? "Approve access for a limited time, or talk it through first."
            : "Track what you asked for. Approvers reply in the thread."
        }
        title="Access requests"
      />
      {reloading ? (
        <ListSkeleton testId={LOADING} />
      ) : phone ? (
        <PhoneRequests {...lists} />
      ) : (
        <RequestTables {...lists} />
      )}
      <ReviewDialog defaultHours={d.defaultHours} maxHours={d.maxHours} onClose={close} row={row} />
      <RequestAccessDialog asking={d.asking} onClose={closeAsk} />
    </div>
  );
};

export default Requests;

export const ErrorBoundary = () => (
  <div className="flex flex-col gap-6">
    <PageHeader eyebrow="Requests" title="Access requests" />
    <PageFailure testId={LOADING} title="Requests didn't load" />
  </div>
);
