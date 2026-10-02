import type { LoaderFunctionArgs } from "react-router";

import { AdminUsersDocument } from "@sneakers-web/api-client";
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@sneakers-web/ui";
import { Check, Plus, Star } from "lucide-react";
import { Form, Link, useLoaderData, useSubmit } from "react-router";

import { PageError } from "@/components/PageError";
import { adminLoad } from "@/lib/admin.server";
import { isSiteAdmin, roleLabels } from "@/lib/roles";

export const loader = ({ request }: LoaderFunctionArgs) =>
  adminLoad(request, async (gw) => {
    const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
    const { users } = await gw.gql(AdminUsersDocument);
    const needle = q.toLowerCase();
    const shown = users
      .filter(
        (u) =>
          !needle || [u.name, u.username, u.email].some((v) => v.toLowerCase().includes(needle)),
      )
      .toSorted((a, b) => a.name.localeCompare(b.name));
    return { q, total: users.length, users: shown };
  });

export const meta = () => [{ title: "Users · Sneakers-PAM admin console" }];

const TONES = ["primary", "warn", "ok", "neutral"] as const;

const Users = () => {
  const { q, total, users } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        actions={
          <Button asChild>
            <Link to="/users/new">
              <Plus aria-hidden />
              New user
            </Link>
          </Button>
        }
        eyebrow="Access · Users"
        title="Users"
      />
      <Card>
        <Form className="border-b border-border p-4.5" method="get" role="search">
          <label className="sr-only" htmlFor="user-search">
            Search users
          </label>
          <Input
            className="max-w-[22.5rem]"
            defaultValue={q}
            id="user-search"
            name="q"
            onChange={(event) =>
              void submit(event.currentTarget.form, { preventScrollReset: true, replace: true })
            }
            placeholder="Search by name, username or email"
            type="search"
          />
        </Form>
        {users.length === 0 ? (
          <div className="p-5">
            <EmptyState
              body={q ? `No user matches "${q}".` : "Create the first account with New user."}
              title={q ? "No matches" : "No users yet"}
            />
          </div>
        ) : (
          <Table>
            <TableHead>
              <tr>
                <TableHeaderCell aria-sort="ascending">Name</TableHeaderCell>
                <TableHeaderCell>Email</TableHeaderCell>
                <TableHeaderCell>Roles</TableHeaderCell>
                <TableHeaderCell>Site admin</TableHeaderCell>
              </tr>
            </TableHead>
            <TableBody>
              {users.map((u, index) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <span className="flex items-center gap-3">
                      <Avatar name={u.name} tone={TONES[index % TONES.length]} />
                      <span className="flex flex-col">
                        <Link className="font-bold" to={`/users/${u.id}`}>
                          {u.name}
                        </Link>
                        <span className="font-mono text-small text-muted">{u.username}</span>
                      </span>
                      {u.disabled && <Badge tone="sunken">Disabled</Badge>}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="flex flex-wrap items-center gap-2">
                      {u.email}
                      {u.emailVerified ? (
                        <Badge icon={<Check aria-hidden strokeWidth={3} />} tone="ok">
                          Verified
                        </Badge>
                      ) : (
                        <Badge tone="warn">Unverified</Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted">{roleLabels(u).join(" · ")}</TableCell>
                  <TableCell>
                    {isSiteAdmin(u) ? (
                      <span className="flex items-center gap-2">
                        Yes
                        {u.isRoot && (
                          <Badge icon={<Star aria-hidden fill="currentColor" />} tone="ink">
                            Root
                          </Badge>
                        )}
                      </span>
                    ) : (
                      <span aria-label="No">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {q && users.length > 0 && (
          <p className="m-0 border-t border-border px-4.5 py-3 text-small text-muted">
            Showing {users.length} of {total}.
          </p>
        )}
      </Card>
    </div>
  );
};

export default Users;

export const ErrorBoundary = () => <PageError />;
