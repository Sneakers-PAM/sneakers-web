import type { LoaderFunctionArgs } from "react-router";

import { AdminServiceAccountsDocument } from "@sneakers-web/api-client";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  shortDate,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@sneakers-web/ui";
import { Link2, Plus } from "lucide-react";
import { Link, useLoaderData } from "react-router";

import { PageError } from "@/components/PageError";
import { adminLoad } from "@/lib/admin.server";

export const loader = ({ request }: LoaderFunctionArgs) =>
  adminLoad(request, async (gw) => {
    const d = await gw.gql(AdminServiceAccountsDocument);
    const names = Object.fromEntries(d.users.map((u) => [u.id, u.name]));
    return {
      accounts: d.serviceAccounts
        .toSorted((a, b) => Number(a.disabled) - Number(b.disabled) || a.name.localeCompare(b.name))
        .map((a) => ({ ...a, createdByName: names[a.createdBy] ?? a.createdBy })),
    };
  });

export const meta = () => [{ title: "Service accounts · Sneakers-PAM admin console" }];

const ServiceAccounts = () => {
  const { accounts } = useLoaderData<typeof loader>();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        actions={
          <Button asChild>
            <Link to="/service-accounts/new">
              <Plus aria-hidden />
              New service account
            </Link>
          </Button>
        }
        eyebrow="Access · Service accounts"
        subtitle="Machine identities for scripts and pipelines. They call the machine API with an API token, or sign in as a linked OIDC client."
        title="Service accounts"
      />
      {accounts.length === 0 ? (
        <EmptyState
          action={
            <Button asChild>
              <Link to="/service-accounts/new">New service account</Link>
            </Button>
          }
          body="Make one for each pipeline or script, so its access and its tokens stay separate."
          title="No service accounts yet"
        />
      ) : (
        <Card>
          <Table>
            <TableHead>
              <tr>
                <TableHeaderCell>Name</TableHeaderCell>
                <TableHeaderCell>Description</TableHeaderCell>
                <TableHeaderCell>Created</TableHeaderCell>
                <TableHeaderCell>Sign-in</TableHeaderCell>
              </tr>
            </TableHead>
            <TableBody>
              {accounts.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <span className="flex flex-wrap items-center gap-2">
                      <Link className="font-bold" to={`/service-accounts/${a.id}`}>
                        {a.name}
                      </Link>
                      {a.disabled && <Badge tone="sunken">Disabled</Badge>}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-96 text-muted">{a.description || "—"}</TableCell>
                  <TableCell className="text-small">
                    {shortDate(a.createdAtUnix * 1000)} by {a.createdByName}
                  </TableCell>
                  <TableCell>
                    {a.oidcSubject ? (
                      <Badge icon={<Link2 aria-hidden />} tone="primary">
                        API tokens + OIDC
                      </Badge>
                    ) : (
                      <span className="text-small text-muted">API tokens</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
};

export default ServiceAccounts;

export const ErrorBoundary = () => <PageError />;
