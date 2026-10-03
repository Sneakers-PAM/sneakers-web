import type { LoaderFunctionArgs } from "react-router";

import { Button, EmptyState, PageHeader, Segmented } from "@sneakers-web/ui";
import { Link, useLoaderData, useNavigate, useNavigation, useSearchParams } from "react-router";

import { loadSecretsByStatus } from "@/features/dashboard/dashboard.server";
import { LoadFailed } from "@/features/dashboard/LoadFailed";
import { SecretsTable } from "@/features/dashboard/SecretsTable";
import { asStatus, type SecretStatus, STATUS_TEXT, STATUSES } from "@/features/dashboard/status";

export const loader = ({ request }: LoaderFunctionArgs) => loadSecretsByStatus(request);

export const meta = ({ location }: { location: { search: string } }) => [
  {
    title: `${STATUS_TEXT[asStatus(new URLSearchParams(location.search).get("status"))].title} · Sneakers-PAM`,
  },
];

/** U-02: the secrets behind a dashboard tile, `?status=expiring|expired|drift|all`, and `?q=` to filter. */
const Secrets = () => {
  const data = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const [parameters] = useSearchParams();
  const q = parameters.get("q") ?? "";
  const status = data.status;
  const text = STATUS_TEXT[status];
  const loading = navigation.state === "loading" && navigation.location.pathname === "/secrets";

  const go = (next: SecretStatus) => {
    const search = new URLSearchParams({ status: next });
    if (q) search.set("q", q);
    void navigate(`/secrets?${search.toString()}`);
  };

  return (
    <div className="flex flex-col gap-5 tablet:gap-6">
      <PageHeader
        actions={
          <Segmented
            label="Status"
            onChange={go}
            options={STATUSES.map((s) => ({ label: STATUS_TEXT[s].tab, value: s }))}
            value={status}
          />
        }
        eyebrow={
          <>
            <Link className="text-primary no-underline hover:text-ink" to="/">
              Dashboard
            </Link>{" "}
            · Secrets by status
          </>
        }
        title={text.title}
      />
      {data.ok ? (
        <SecretsTable
          empty={
            <EmptyState
              action={
                <Button asChild variant="secondary">
                  <Link to="/">Back to the dashboard</Link>
                </Button>
              }
              body={text.empty}
              title={text.emptyTitle}
            />
          }
          initialFilter={q}
          key={q}
          loading={loading}
          rows={data.rows}
        />
      ) : (
        <LoadFailed failure={data.failure} title="Couldn't load these secrets" />
      )}
    </div>
  );
};

export default Secrets;
