import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { AdminDeleteTargetDocument, AdminTargetsDocument } from "@sneakers-web/api-client";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  plural,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  Tooltip,
} from "@sneakers-web/ui";
import { KeyRound, Plus, TriangleAlert } from "lucide-react";
import { Link, useFetcher, useLoaderData } from "react-router";

import { useResultToast } from "@/components/Admin";
import { PageError } from "@/components/PageError";
import { adminAct, adminLoad, text } from "@/lib/admin.server";

export const loader = ({ request }: LoaderFunctionArgs) =>
  adminLoad(request, async (gw) => {
    const d = await gw.gql(AdminTargetsDocument);
    const connections = Object.fromEntries(d.connections.map((c) => [c.id, c]));
    return {
      targets: d.targets
        .toSorted((a, b) => a.name.localeCompare(b.name))
        .map((t) => ({ ...t, connection: connections[t.connectionId] ?? null })),
    };
  });

export const action = async ({ request }: ActionFunctionArgs) => {
  const form = await request.formData();
  return adminAct(request, "delete", async (gw) => {
    await gw.gql(AdminDeleteTargetDocument, { id: text(form, "id") });
    return `Deleted ${text(form, "name")}.`;
  });
};

export const meta = () => [{ title: "Targets · Sneakers-PAM admin console" }];

const Targets = () => {
  const { targets } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  useResultToast(fetcher.data);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        actions={
          <Button asChild>
            <Link to="/targets/new">
              <Plus aria-hidden />
              New target
            </Link>
          </Button>
        }
        eyebrow="Configuration · Targets"
        subtitle="The systems Sneakers-PAM checks and rotates on. Each binds to a connection and adds its hostname."
        title="Targets"
      />
      {targets.length === 0 ? (
        <EmptyState
          action={
            <Button asChild>
              <Link to="/targets/new">New target</Link>
            </Button>
          }
          body="Add a host, then point secrets at it so heartbeats and rotation can run."
          title="No targets yet"
        />
      ) : (
        <Card>
          <Table>
            <TableHead>
              <tr>
                <TableHeaderCell>Name</TableHeaderCell>
                <TableHeaderCell>Hostname</TableHeaderCell>
                <TableHeaderCell>Connection</TableHeaderCell>
                <TableHeaderCell>Host keys</TableHeaderCell>
                <TableHeaderCell>In use</TableHeaderCell>
                <TableHeaderCell>
                  <span className="sr-only">Actions</span>
                </TableHeaderCell>
              </tr>
            </TableHead>
            <TableBody>
              {targets.map((t) => {
                const ssh = t.connection?.protocol === "ssh";
                return (
                  <TableRow key={t.id}>
                    <TableCell>
                      <span className="flex flex-wrap items-center gap-2">
                        <Link className="font-bold" to={`/targets/${t.id}`}>
                          {t.name}
                        </Link>
                        {t.ownerUserId && <Badge tone="sunken">Personal</Badge>}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-small">{t.hostname}</TableCell>
                    <TableCell>
                      {t.connection
                        ? `${t.connection.name} (${t.connection.protocol}${t.connection.port ? `:${t.connection.port}` : ""})`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {t.sshHostKeys.length > 0 ? (
                        <Badge icon={<KeyRound aria-hidden />} tone="ok">
                          {plural(t.sshHostKeys.length, "pin")}
                        </Badge>
                      ) : ssh ? (
                        <Badge icon={<TriangleAlert aria-hidden />} tone="warn">
                          Not pinned
                        </Badge>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono">{t.secretCount}</TableCell>
                    <TableCell>
                      <span className="flex justify-end gap-2">
                        <Button asChild size="sm" variant="secondary">
                          <Link aria-label={`Edit ${t.name}`} to={`/targets/${t.id}`}>
                            Edit
                          </Link>
                        </Button>
                        {t.secretCount > 0 ? (
                          <Tooltip
                            content={`${plural(t.secretCount, "secret")} ${t.secretCount === 1 ? "points" : "point"} at it.`}
                          >
                            <Button
                              aria-disabled
                              aria-label={`Delete ${t.name}`}
                              className="cursor-not-allowed bg-sunken text-muted hover:bg-sunken"
                              size="sm"
                              variant="ghost"
                            >
                              Delete
                            </Button>
                          </Tooltip>
                        ) : (
                          <fetcher.Form method="post">
                            <input name="id" type="hidden" value={t.id} />
                            <input name="name" type="hidden" value={t.name} />
                            <Button
                              aria-label={`Delete ${t.name}`}
                              className="border-danger text-danger"
                              size="sm"
                              type="submit"
                              variant="secondary"
                            >
                              Delete
                            </Button>
                          </fetcher.Form>
                        )}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
      <p className="m-0 text-small text-muted">
        An SSH target with no host keys is refused: the connector and the SSH broker only connect to
        a host that presents a pinned key.
      </p>
    </div>
  );
};

export default Targets;

export const ErrorBoundary = () => <PageError />;
