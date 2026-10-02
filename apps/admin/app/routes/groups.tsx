import type { LoaderFunctionArgs } from "react-router";

import { AdminGroupsDocument } from "@sneakers-web/api-client";
import {
  Button,
  Card,
  EmptyState,
  PageHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@sneakers-web/ui";
import { Diamond, Plus } from "lucide-react";
import { Link, useLoaderData } from "react-router";

import { PageError } from "@/components/PageError";
import { adminLoad } from "@/lib/admin.server";

export const loader = ({ request }: LoaderFunctionArgs) =>
  adminLoad(request, async (gw) => {
    const { groups } = await gw.gql(AdminGroupsDocument);
    return { groups: groups.toSorted((a, b) => a.name.localeCompare(b.name)) };
  });

export const meta = () => [{ title: "Groups · Sneakers-PAM admin console" }];

const Groups = () => {
  const { groups } = useLoaderData<typeof loader>();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        actions={
          <Button asChild>
            <Link to="/groups/new">
              <Plus aria-hidden />
              New group
            </Link>
          </Button>
        }
        eyebrow="Access · Groups"
        subtitle="Groups grant folder access. Open one to manage its members."
        title="Groups"
      />
      {groups.length === 0 ? (
        <EmptyState
          action={
            <Button asChild>
              <Link to="/groups/new">New group</Link>
            </Button>
          }
          body="Folder rules name groups, so people get access by joining one."
          title="No groups yet"
        />
      ) : (
        <Card>
          <Table>
            <TableHead>
              <tr>
                <TableHeaderCell>Name</TableHeaderCell>
                <TableHeaderCell>ID</TableHeaderCell>
              </tr>
            </TableHead>
            <TableBody>
              {groups.map((g) => (
                <TableRow key={g.id}>
                  <TableCell>
                    <span className="flex items-center gap-2.5">
                      <Diamond aria-hidden className="size-4 text-muted" />
                      <Link className="font-bold" to={`/groups/${g.id}`}>
                        {g.name}
                      </Link>
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-small text-muted">{g.id}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
};

export default Groups;

export const ErrorBoundary = () => <PageError />;
