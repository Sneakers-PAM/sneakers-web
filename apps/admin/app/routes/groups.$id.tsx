import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import {
  AdminAddGroupMemberDocument,
  AdminGroupDocument,
  AdminRemoveGroupMemberDocument,
  AdminSearchUsersDocument,
  GraphQLRequestError,
} from "@sneakers-web/api-client";
import { Avatar, Input, PageHeader, plural } from "@sneakers-web/ui";
import { Form, Link, useFetcher, useLoaderData, useSubmit } from "react-router";

import { Panel, useResultToast } from "@/components/Admin";
import { PageError } from "@/components/PageError";
import { adminAct, adminLoad, text } from "@/lib/admin.server";

export const loader = ({ params, request }: LoaderFunctionArgs) =>
  adminLoad(request, async (gw) => {
    const id = params.id ?? "";
    const find = new URL(request.url).searchParams.get("find")?.trim() ?? "";
    const [d, hits] = await Promise.all([
      gw.gql(AdminGroupDocument, { id }),
      find
        ? gw.gql(AdminSearchUsersDocument, { limit: 8, query: find }).then((r) => r.searchUsers)
        : [],
    ]);
    const group = d.groups.find((g) => g.id === id);
    if (!group)
      throw new GraphQLRequestError([
        { extensions: { code: "NOT_FOUND" }, message: "group not found" },
      ]);
    const members = d.groupMembers.toSorted((a, b) => a.name.localeCompare(b.name));
    return { find, group, hits: hits.filter((h) => !members.some((m) => m.id === h.id)), members };
  });

export const action = async ({ params, request }: ActionFunctionArgs) => {
  const form = await request.formData();
  const intent = text(form, "intent");
  const groupId = params.id ?? "";
  const userId = text(form, "userId");
  const name = text(form, "name");
  return adminAct(request, intent, async (gw) => {
    if (intent === "add") {
      await gw.gql(AdminAddGroupMemberDocument, { groupId, userId });
      return `Added ${name}.`;
    }
    await gw.gql(AdminRemoveGroupMemberDocument, { groupId, userId });
    return `Removed ${name}.`;
  });
};

export const meta = ({ data }: { data?: Awaited<ReturnType<typeof loader>> }) => [
  { title: `${data?.group.name ?? "Group"} · Sneakers-PAM admin console` },
];

const GroupDetail = () => {
  const { find, group, hits, members } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  useResultToast(fetcher.data);
  const submit = useSubmit();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={
          <>
            Access · <Link to="/groups">Groups</Link>
          </>
        }
        subtitle={`Group · ${plural(members.length, "member")}`}
        title={group.name}
      />
      <Panel title="Members">
        {members.length === 0 ? (
          <p className="m-0 text-small text-muted">No members yet. Search for people below.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col p-0">
            {members.map((m) => (
              <li
                className="flex items-center gap-3 border-t border-border py-3 first:border-t-0 first:pt-0"
                key={m.id}
              >
                <Avatar name={m.name} tone="neutral" />
                <Link className="font-bold text-ink" to={`/users/${m.id}`}>
                  {m.name}
                </Link>
                <span className="text-small text-muted">{m.email}</span>
                <fetcher.Form className="ml-auto" method="post">
                  <input name="intent" type="hidden" value="remove" />
                  <input name="userId" type="hidden" value={m.id} />
                  <input name="name" type="hidden" value={m.name} />
                  <button
                    aria-label={`Remove ${m.name}`}
                    className="text-small font-bold text-danger hover:underline"
                    type="submit"
                  >
                    Remove
                  </button>
                </fetcher.Form>
              </li>
            ))}
          </ul>
        )}
        <Form
          className="flex flex-col gap-2 border-t border-border pt-4"
          method="get"
          role="search"
        >
          <label className="text-[0.875rem] font-bold" htmlFor="member-search">
            Add member…
          </label>
          <Input
            autoComplete="off"
            className="max-w-[20rem]"
            defaultValue={find}
            id="member-search"
            name="find"
            onChange={(event) =>
              void submit(event.currentTarget.form, { preventScrollReset: true, replace: true })
            }
            placeholder="Name, username or email"
            type="search"
          />
          {find && (
            <ul
              aria-label="Matching people"
              className="m-0 flex max-w-[20rem] list-none flex-col gap-1 rounded-md border border-border bg-surface p-1 shadow-menu"
            >
              {hits.length === 0 ? (
                <li className="px-3 py-2 text-small text-muted">No one else matches.</li>
              ) : (
                hits.map((h) => (
                  <li key={h.id}>
                    <fetcher.Form method="post">
                      <input name="intent" type="hidden" value="add" />
                      <input name="userId" type="hidden" value={h.id} />
                      <input name="name" type="hidden" value={h.name} />
                      <button
                        aria-label={`Add ${h.name}`}
                        className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left hover:bg-primary-soft"
                        type="submit"
                      >
                        <b className="text-[0.875rem]">{h.name}</b>
                        <span className="text-small text-muted">{h.email}</span>
                      </button>
                    </fetcher.Form>
                  </li>
                ))
              )}
            </ul>
          )}
        </Form>
      </Panel>
    </div>
  );
};

export default GroupDetail;

export const ErrorBoundary = () => <PageError back="/groups" backLabel="Back to groups" />;
