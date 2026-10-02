import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import {
  AdminAddGroupMemberDocument,
  AdminRemoveGroupMemberDocument,
  AdminRequestEmailVerificationDocument,
  AdminRevokeUserTokenDocument,
  AdminSetUserDisabledDocument,
  AdminSetUserRolesDocument,
  AdminUpdateUserDocument,
  AdminUserDocument,
  ApiError,
  type GatewayClient,
  GraphQLRequestError,
} from "@sneakers-web/api-client";
import {
  Alert,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  Badge,
  Button,
  Field,
  GrantPill,
  type GrantStatus,
  Input,
  PageHeader,
  Switch,
  timeAgo,
} from "@sneakers-web/ui";
import { Check, Diamond, Plus, Star, TriangleAlert, X } from "lucide-react";
import { useState } from "react";
import { Link, useFetcher, useLoaderData, useRouteLoaderData } from "react-router";

import type { loader as frameLoader } from "@/routes/frame";

import { Panel, SettingRow, useResultToast } from "@/components/Admin";
import { PageError } from "@/components/PageError";
import { adminAct, adminLoad, text } from "@/lib/admin.server";
import { isSiteAdmin, RECOVERY_ROLE, withRole } from "@/lib/roles";

/** Whether the user has a confirmed second factor. Null when the gateway didn't say. */
const mfaEnrolled = async (gw: GatewayClient, userId: string): Promise<boolean | null> => {
  try {
    const r = await gw.request<{ enrolled?: boolean }>(
      `/auth/mfa/admin/status?userId=${encodeURIComponent(userId)}`,
    );
    return !!r.enrolled;
  } catch {
    return null;
  }
};

export const loader = ({ params, request }: LoaderFunctionArgs) =>
  adminLoad(request, async (gw) => {
    const id = params.id ?? "";
    const [d, enrolled] = await Promise.all([
      gw.gql(AdminUserDocument, { id }),
      mfaEnrolled(gw, id),
    ]);
    if (!d.user)
      throw new GraphQLRequestError([
        { extensions: { code: "NOT_FOUND" }, message: "user not found" },
      ]);
    return {
      enrolled,
      groups: d.groups,
      memberOf: d.userGroups,
      tokens: d.userTokens,
      user: d.user,
    };
  });

/** The admin MFA routes answer plain HTTP errors; give them the shape of a refusal. */
const adminRoute = async (work: () => Promise<unknown>) => {
  try {
    await work();
  } catch (error) {
    if (error instanceof ApiError && error.status === 403)
      throw new GraphQLRequestError([
        {
          extensions: { code: "PERMISSION_DENIED", reason: "NOT_SITE_ADMIN" },
          message: "site admin required",
        },
      ]);
    throw error;
  }
};

export const action = async ({ params, request }: ActionFunctionArgs) => {
  const userId = params.id ?? "";
  const form = await request.formData();
  const intent = text(form, "intent");
  return adminAct(request, intent, async (gw) => {
    switch (intent) {
      case "add-group": {
        await gw.gql(AdminAddGroupMemberDocument, { groupId: text(form, "groupId"), userId });
        return `Added to ${text(form, "groupName")}.`;
      }
      case "disabled": {
        const disabled = text(form, "on") === "true";
        await gw.gql(AdminSetUserDisabledDocument, { disabled, userId });
        return disabled
          ? "User disabled. Their sign-in and tokens stop working now."
          : "User enabled.";
      }
      case "identity": {
        const r = await gw.gql(AdminUpdateUserDocument, {
          email: text(form, "email"),
          name: text(form, "name"),
          userId,
          username: text(form, "username"),
        });
        return `Saved ${r.updateUser.name}'s details.`;
      }
      case "remove-group": {
        await gw.gql(AdminRemoveGroupMemberDocument, { groupId: text(form, "groupId"), userId });
        return `Removed from ${text(form, "groupName")}.`;
      }
      case "remove-totp": {
        await adminRoute(() =>
          gw.request("/auth/mfa/admin/remove-totp", { body: { userId }, csrf: true }),
        );
        return "Authenticator removed. They're signed out everywhere and set up a new one at next sign-in.";
      }
      case "resend": {
        await gw.gql(AdminRequestEmailVerificationDocument, { userId });
        return "Verification email sent.";
      }
      case "revoke-token": {
        await gw.gql(AdminRevokeUserTokenDocument, { id: text(form, "tokenId"), userId });
        return `Token ${text(form, "label")} revoked. It stops working on its next request.`;
      }
      case "role": {
        const role = text(form, "role");
        const on = text(form, "on") === "true";
        const { user } = await gw.gql(AdminUserDocument, { id: userId });
        await gw.gql(AdminSetUserRolesDocument, {
          roles: withRole(user?.roles ?? [], role, on),
          userId,
        });
        const name = role === RECOVERY_ROLE ? "Recovery role" : "Site admin";
        return on ? `${name} granted.` : `${name} removed.`;
      }
    }
    throw new GraphQLRequestError([
      { extensions: { code: "INVALID_ARGUMENT" }, message: "unknown action" },
    ]);
  });
};

export const meta = ({ data }: { data?: Awaited<ReturnType<typeof loader>> }) => [
  { title: `${data?.user.name ?? "User"} · Sneakers-PAM admin console` },
];

const now = () => Math.floor(Date.now() / 1000);

const tokenStatus = (t: { expiresAtUnix: number; revokedAtUnix: number }): GrantStatus => {
  if (t.revokedAtUnix) return "revoked";
  if (t.expiresAtUnix && t.expiresAtUnix < now()) return "expired";
  return "active";
};

const UserDetail = () => {
  const { enrolled, groups, memberOf, tokens, user } = useLoaderData<typeof loader>();
  const me = useRouteLoaderData<typeof frameLoader>("routes/frame")?.user;
  const self = me?.id === user.id;
  const fetcher = useFetcher<typeof action>();
  useResultToast(fetcher.data);
  const save = useFetcher<typeof action>();
  useResultToast(save.data);
  const [username, setUsername] = useState(user.username);
  const [confirmTotp, setConfirmTotp] = useState(false);
  const admin = isSiteAdmin(user);
  const recovery = user.roles.includes(RECOVERY_ROLE);
  const others = groups.filter((g) => !memberOf.some((m) => m.id === g.id));
  const toggle = (intent: string, on: boolean, extra: Record<string, string> = {}) =>
    void fetcher.submit({ intent, on: String(on), ...extra }, { method: "post" });
  const saveRefusal = save.data && !save.data.ok ? save.data.refusal : undefined;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={
          <>
            <Link to="/users">Users</Link> · {user.name}
          </>
        }
        title={
          <span className="flex flex-wrap items-center gap-3">
            {user.name}
            {user.isRoot && (
              <Badge icon={<Star aria-hidden fill="currentColor" />} tone="ink">
                Root admin
              </Badge>
            )}
            {user.disabled && <Badge tone="sunken">Disabled</Badge>}
          </span>
        }
      />
      {user.isRoot && (
        <Alert tone="info">
          <b>This is the root admin</b>, created at setup. It can&apos;t be demoted or disabled, so
          there is always someone who can get in.
        </Alert>
      )}
      <div className="grid items-start gap-5 desktop:grid-cols-2">
        <div className="flex flex-col gap-5">
          <Panel title="Identity">
            <save.Form className="flex flex-col gap-4" method="post">
              <input name="intent" type="hidden" value="identity" />
              <Field label="Display name">
                <Input autoComplete="off" defaultValue={user.name} name="name" required />
              </Field>
              <Field
                hint={
                  username.trim() === user.username
                    ? undefined
                    : "They sign in with their email, so their password doesn't change."
                }
                label="Username"
              >
                <Input
                  autoCapitalize="none"
                  autoComplete="off"
                  mono
                  name="username"
                  onChange={(event) => setUsername(event.target.value)}
                  required
                  spellCheck={false}
                  value={username}
                />
              </Field>
              <Field label="Email">
                <Input
                  autoComplete="off"
                  defaultValue={user.email}
                  name="email"
                  required
                  type="email"
                />
              </Field>
              {user.emailVerified ? (
                <div className="flex items-center gap-2 rounded-md bg-ok-soft px-3.5 py-2.5 text-small font-bold text-ok">
                  <Check aria-hidden className="size-4" strokeWidth={3} />
                  Email verified
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md bg-warn-soft px-3.5 py-2.5 text-small">
                  <span className="flex items-center gap-2 font-bold text-warn">
                    <TriangleAlert aria-hidden className="size-4" />
                    Email not verified yet
                  </span>
                  <span className="ml-auto flex gap-4">
                    <button
                      className="font-bold text-primary hover:text-ink"
                      onClick={() => void fetcher.submit({ intent: "resend" }, { method: "post" })}
                      type="button"
                    >
                      Resend email
                    </button>
                    <Link className="font-bold" to={`/users/${user.id}/verify`}>
                      Enter code…
                    </Link>
                  </span>
                </div>
              )}
              {saveRefusal && (
                <Alert title="Couldn't save the changes" tone="danger">
                  {saveRefusal.detail}
                </Alert>
              )}
              <Button
                className="self-end"
                loading={save.state !== "idle"}
                loadingLabel="Saving…"
                type="submit"
              >
                Save identity
              </Button>
            </save.Form>
          </Panel>

          <Panel title="Groups">
            {memberOf.length === 0 && others.length === 0 && (
              <p className="m-0 text-small text-muted">No groups yet. Create one under Groups.</p>
            )}
            <div className="flex flex-wrap gap-2">
              {memberOf.map((g) => (
                <fetcher.Form key={g.id} method="post">
                  <input name="intent" type="hidden" value="remove-group" />
                  <input name="groupId" type="hidden" value={g.id} />
                  <input name="groupName" type="hidden" value={g.name} />
                  <span className="inline-flex h-9.5 items-center gap-2 rounded-sm bg-sunken pr-1.5 pl-3 text-[0.875rem] font-bold">
                    <Diamond aria-hidden className="size-3.5" />
                    {g.name}
                    <button
                      aria-label={`Remove from ${g.name}`}
                      className="inline-flex size-6 items-center justify-center rounded-xs text-muted hover:bg-surface hover:text-danger"
                      type="submit"
                    >
                      <X aria-hidden className="size-3.5" />
                    </button>
                  </span>
                </fetcher.Form>
              ))}
              {others.map((g) => (
                <fetcher.Form key={g.id} method="post">
                  <input name="intent" type="hidden" value="add-group" />
                  <input name="groupId" type="hidden" value={g.id} />
                  <input name="groupName" type="hidden" value={g.name} />
                  <button
                    aria-label={`Add to ${g.name}`}
                    className="inline-flex h-9.5 items-center gap-1.5 rounded-sm border-[1.5px] border-dashed border-border-strong px-3 text-[0.875rem] font-bold hover:border-control hover:bg-sunken"
                    type="submit"
                  >
                    <Plus aria-hidden className="size-3.5" />
                    {g.name}
                  </button>
                </fetcher.Form>
              ))}
            </div>
          </Panel>
        </div>

        <div className="flex flex-col gap-5">
          <Panel title="Admin access & security">
            <div className="flex flex-col gap-4">
              <SettingRow
                body={
                  user.isRoot
                    ? "Locked: the root admin always keeps admin access."
                    : "Can configure everything, read the audit trail, break glass and hard-delete."
                }
                control={
                  <Switch
                    aria-labelledby="sw-admin"
                    checked={admin}
                    disabled={user.isRoot}
                    onCheckedChange={(on) => toggle("role", on, { role: "site-admin" })}
                  />
                }
                id="sw-admin"
                title="Site admin"
              />
              <SettingRow
                body="Can see and restore a secret's earlier values, with a fresh second factor each time. Only a site admin can grant it, and every grant and revoke is recorded at high severity."
                control={
                  <Switch
                    aria-labelledby="sw-recovery"
                    checked={recovery}
                    onCheckedChange={(on) => toggle("role", on, { role: RECOVERY_ROLE })}
                  />
                }
                id="sw-recovery"
                title="Recovery"
              />
              <SettingRow
                body={
                  enrolled === false
                    ? "Not set up."
                    : enrolled
                      ? "Set up. Removing it signs them out everywhere; they set up a new one at next sign-in."
                      : "Couldn't read their factor status."
                }
                control={
                  enrolled ? (
                    <Button
                      className="border-danger text-danger"
                      onClick={() => setConfirmTotp(true)}
                      size="sm"
                      variant="secondary"
                    >
                      Remove…
                    </Button>
                  ) : null
                }
                title="Authenticator app"
              />
              <SettingRow
                body={
                  user.isRoot
                    ? "The root admin can't be disabled."
                    : self
                      ? "You can't disable your own account."
                      : "Blocks sign-in and stops every token right away."
                }
                control={
                  <Switch
                    aria-labelledby="sw-disabled"
                    checked={user.disabled}
                    disabled={user.isRoot || self}
                    onCheckedChange={(on) => toggle("disabled", on)}
                  />
                }
                id="sw-disabled"
                title="Disable user"
              />
            </div>
          </Panel>

          <Panel flush title="Personal tokens">
            {tokens.length === 0 ? (
              <p className="m-0 border-t border-border px-5.5 py-4 text-small text-muted">
                No personal tokens. They appear here when {user.name} connects an agent or the CLI.
              </p>
            ) : (
              <ul className="m-0 list-none border-t border-border p-0">
                {tokens.map((t) => {
                  const status = tokenStatus(t);
                  return (
                    <li
                      className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-border px-5.5 py-3 first:border-t-0"
                      key={t.id}
                    >
                      <span className="flex min-w-36 flex-col">
                        <b className="text-[0.875rem]">{t.label}</b>
                        <span className="text-small text-muted">
                          {t.lastUsedAtUnix
                            ? `Used ${timeAgo(t.lastUsedAtUnix * 1000)}`
                            : "Never used"}
                        </span>
                      </span>
                      <span className="text-small text-muted">{t.clientName}</span>
                      <GrantPill status={status} />
                      {status === "active" && (
                        <fetcher.Form className="ml-auto" method="post">
                          <input name="intent" type="hidden" value="revoke-token" />
                          <input name="tokenId" type="hidden" value={t.id} />
                          <input name="label" type="hidden" value={t.label} />
                          <Button
                            aria-label={`Revoke ${t.label}`}
                            className="border-danger text-danger"
                            size="sm"
                            type="submit"
                            variant="secondary"
                          >
                            Revoke
                          </Button>
                        </fetcher.Form>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      <AlertDialog onOpenChange={setConfirmTotp} open={confirmTotp}>
        <AlertDialogContent>
          <AlertDialogTitle>Remove {user.name}&apos;s authenticator?</AlertDialogTitle>
          <AlertDialogDescription>
            Their current authenticator codes stop working and every session they have is signed
            out. They set up a new one the next time they sign in.
          </AlertDialogDescription>
          <div className="flex justify-end gap-2.5">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void fetcher.submit({ intent: "remove-totp" }, { method: "post" })}
            >
              Remove authenticator
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default UserDetail;

export const ErrorBoundary = () => <PageError back="/users" backLabel="Back to users" />;
