import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import {
  AdminDisableServiceAccountDocument,
  AdminLinkOidcClientDocument,
  AdminMintApiTokenDocument,
  AdminRevokeApiTokenDocument,
  AdminServiceAccountDocument,
  AdminUnlinkOidcClientDocument,
  GraphQLRequestError,
} from "@sneakers-web/api-client";
import { refusalMessage } from "@sneakers-web/shell";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  GrantPill,
  type GrantStatus,
  Input,
  PageHeader,
  shortDate,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  timeAgo,
  toast,
} from "@sneakers-web/ui";
import { Copy, KeyRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useFetcher, useLoaderData } from "react-router";

import { Choice, GroupPicker, Panel, useResultToast } from "@/components/Admin";
import { PageError } from "@/components/PageError";
import { adminAct, adminLoad, text } from "@/lib/admin.server";

const DAY = 86_400;

export const loader = ({ params, request }: LoaderFunctionArgs) =>
  adminLoad(request, async (gw) => {
    const id = params.id ?? "";
    const d = await gw.gql(AdminServiceAccountDocument, { id });
    const account = d.serviceAccounts.find((a) => a.id === id);
    if (!account)
      throw new GraphQLRequestError([
        { extensions: { code: "NOT_FOUND" }, message: "service account not found" },
      ]);
    const names = Object.fromEntries(d.users.map((u) => [u.id, u.name]));
    return {
      account: { ...account, createdByName: names[account.createdBy] ?? account.createdBy },
      groups: d.groups.toSorted((a, b) => a.name.localeCompare(b.name)),
      tokens: d.apiTokens.toSorted((a, b) => Number(!!a.revokedAtUnix) - Number(!!b.revokedAtUnix)),
    };
  });

/** "mint" answers the one-time token value in `done`. It is never toasted or logged. */
export const action = async ({ params, request }: ActionFunctionArgs) => {
  const form = await request.formData();
  const intent = text(form, "intent");
  const serviceAccountId = params.id ?? "";
  return adminAct(request, intent, async (gw) => {
    switch (intent) {
      case "disable": {
        await gw.gql(AdminDisableServiceAccountDocument, { id: serviceAccountId });
        return "Service account disabled. Its tokens stop working now.";
      }
      case "link": {
        await gw.gql(AdminLinkOidcClientDocument, {
          allowedGroups: form.getAll("group").map(String),
          oidcSubject: text(form, "oidcSubject"),
          serviceAccountId,
        });
        return "OIDC client saved.";
      }
      case "mint": {
        const days = Number(text(form, "days"));
        const r = await gw.gql(AdminMintApiTokenDocument, {
          expiresAt: days > 0 ? Math.floor(Date.now() / 1000) + days * DAY : null,
          scope: form.getAll("group").map(String).join(" "),
          serviceAccountId,
        });
        return r.mintApiToken.token;
      }
      case "revoke": {
        await gw.gql(AdminRevokeApiTokenDocument, { id: text(form, "id") });
        return "Token revoked. It stops working on its next request.";
      }
      case "unlink": {
        await gw.gql(AdminUnlinkOidcClientDocument, { serviceAccountId });
        return "OIDC client unlinked. Its API tokens still work.";
      }
    }
    throw new GraphQLRequestError([
      { extensions: { code: "INVALID_ARGUMENT" }, message: "unknown action" },
    ]);
  });
};

export const meta = ({ data }: { data?: Awaited<ReturnType<typeof loader>> }) => [
  { title: `${data?.account.name ?? "Service account"} · Sneakers-PAM admin console` },
];

type Token = Awaited<ReturnType<typeof loader>>["tokens"][number];

const statusOf = (t: Token): GrantStatus => {
  if (t.revokedAtUnix) return "revoked";
  if (t.expiresAtUnix && t.expiresAtUnix * 1000 < Date.now()) return "expired";
  return "active";
};

const EXPIRY = [
  { label: "30 days", value: "30" },
  { label: "90 days", value: "90" },
  { label: "1 year", value: "365" },
  { label: "No expiry", value: "0" },
];

const MintDialog = ({
  groups,
  onClose,
  open,
}: {
  groups: { id: string; name: string }[];
  onClose: () => void;
  open: boolean;
}) => {
  const fetcher = useFetcher<typeof action>();
  const [scope, setScope] = useState<string[]>([]);
  const [days, setDays] = useState("90");
  // When the token was asked for, so the dialog can say when it expires.
  const [mintedAt, setMintedAt] = useState(0);
  const result = fetcher.data?.intent === "mint" ? fetcher.data : undefined;
  const minted = result?.ok ? result.done : null;
  const close = () => {
    setScope([]);
    setDays("90");
    onClose();
  };
  const name = (id: string) => groups.find((g) => g.id === id)?.name ?? id;
  return (
    <Dialog onOpenChange={(o) => !o && !minted && close()} open={open}>
      <DialogContent className="max-w-[33rem]" hideClose={!!minted}>
        {minted ? (
          <>
            <DialogHeader>
              <DialogTitle>Token minted</DialogTitle>
              <DialogDescription>
                Copy it now. This is the only time it is shown; we keep only a hash.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-3 rounded-lg bg-sunken px-4 py-3">
              <code
                aria-label="New API token"
                className="min-w-0 flex-1 font-mono text-[0.9375rem] break-all"
              >
                {minted}
              </code>
              <Button
                onClick={() =>
                  void navigator.clipboard
                    .writeText(minted)
                    .then(() => toast("Token copied"))
                    .catch(() => toast.error("Couldn't copy. Select it and copy by hand."))
                }
                size="sm"
                variant="secondary"
              >
                <Copy aria-hidden />
                Copy
              </Button>
            </div>
            <dl className="m-0 grid grid-cols-[6rem_1fr] gap-y-1.5 text-small">
              <dt className="text-muted">Scope</dt>
              <dd className="m-0 font-bold">{scope.map((id) => name(id)).join(", ")}</dd>
              <dt className="text-muted">Expires</dt>
              <dd className="m-0">
                {days === "0"
                  ? "Never"
                  : `${shortDate(mintedAt + Number(days) * DAY * 1000)} (${days} days)`}
              </dd>
            </dl>
            <Alert title="Lost it? Mint a new one" tone="warn">
              Then revoke this one. Nobody, including admins, can show it again.
            </Alert>
            <DialogFooter>
              <Button onClick={close}>Done, I&apos;ve stored it</Button>
            </DialogFooter>
          </>
        ) : (
          <fetcher.Form
            className="flex flex-col gap-5"
            method="post"
            onSubmit={() => setMintedAt(Date.now())}
          >
            <input name="intent" type="hidden" value="mint" />
            {scope.map((id) => (
              <input key={id} name="group" type="hidden" value={id} />
            ))}
            <input name="days" type="hidden" value={days} />
            <DialogHeader>
              <DialogTitle>Mint an API token</DialogTitle>
              <DialogDescription>
                The groups are the token&apos;s only access: it can reach what folder rules give
                those groups.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              <span className="text-[0.875rem] font-bold">Scope</span>
              <GroupPicker groups={groups} label="Token scope" onChange={setScope} value={scope} />
            </div>
            <Field label="Expires after">
              <Choice onChange={setDays} options={EXPIRY} value={days} />
            </Field>
            {result && !result.ok && <Alert tone="danger">{refusalMessage(result.refusal)}</Alert>}
            <DialogFooter>
              <Button onClick={close} variant="secondary">
                Cancel
              </Button>
              <Button
                disabled={scope.length === 0}
                loading={fetcher.state !== "idle"}
                loadingLabel="Minting…"
                type="submit"
              >
                Mint token
              </Button>
            </DialogFooter>
          </fetcher.Form>
        )}
      </DialogContent>
    </Dialog>
  );
};

const ServiceAccountDetail = () => {
  const { account, groups, tokens } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  useResultToast(fetcher.data);
  const link = useFetcher<typeof action>();
  useResultToast(link.data);
  const [minting, setMinting] = useState(false);
  const [confirmDisable, setConfirmDisable] = useState(false);
  const [subject, setSubject] = useState(account.oidcSubject ?? "");
  const [allowed, setAllowed] = useState<string[]>(account.oidcAllowedGroups);
  const linked = !!account.oidcSubject;
  const name = (id: string) => groups.find((g) => g.id === id)?.name ?? id;
  const synced = useRef(account);
  useEffect(() => {
    if (synced.current === account) return;
    synced.current = account;
    setSubject(account.oidcSubject ?? "");
    setAllowed(account.oidcAllowedGroups);
  }, [account]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        actions={
          account.disabled ? undefined : (
            <>
              <Button
                className="border-danger text-danger"
                onClick={() => setConfirmDisable(true)}
                variant="secondary"
              >
                Disable…
              </Button>
              <Button onClick={() => setMinting(true)}>
                <KeyRound aria-hidden />
                Mint token…
              </Button>
            </>
          )
        }
        eyebrow="Access · Service accounts"
        subtitle={`Machine identity · created ${shortDate(account.createdAtUnix * 1000)} by ${account.createdByName}`}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {account.name}
            {account.disabled && <Badge tone="sunken">Disabled</Badge>}
          </span>
        }
      />
      {account.disabled && (
        <Alert tone="info">
          This service account is disabled. Its tokens and its OIDC client no longer work, and it
          can&apos;t be turned back on; make a new one if it&apos;s needed again.
        </Alert>
      )}
      <div className="grid items-start gap-5 desktop:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-5">
          <Panel title="Details">
            <dl className="m-0 flex flex-col gap-3">
              <div>
                <dt className="text-[0.875rem] font-bold">Name</dt>
                <dd className="m-0">{account.name}</dd>
              </div>
              <div>
                <dt className="text-[0.875rem] font-bold">Description</dt>
                <dd className="m-0 text-muted">{account.description || "—"}</dd>
              </div>
            </dl>
          </Panel>
          <Panel flush title="API tokens">
            {tokens.length === 0 ? (
              <p className="m-0 border-t border-border px-5.5 py-4 text-small text-muted">
                No tokens yet. Mint one for the pipeline or script that runs as this account.
              </p>
            ) : (
              <Table>
                <TableHead>
                  <tr>
                    <TableHeaderCell>Scope</TableHeaderCell>
                    <TableHeaderCell>Expires</TableHeaderCell>
                    <TableHeaderCell>Last used</TableHeaderCell>
                    <TableHeaderCell>Status</TableHeaderCell>
                    <TableHeaderCell>
                      <span className="sr-only">Actions</span>
                    </TableHeaderCell>
                  </tr>
                </TableHead>
                <TableBody>
                  {tokens.map((t) => {
                    const status = statusOf(t);
                    const scope = t.scope
                      .split(" ")
                      .filter(Boolean)
                      .map((id) => name(id))
                      .join(", ");
                    return (
                      <TableRow key={t.id}>
                        <TableCell className="font-bold">{scope}</TableCell>
                        <TableCell className="text-small">
                          {t.expiresAtUnix ? shortDate(t.expiresAtUnix * 1000) : "Never"}
                        </TableCell>
                        <TableCell className="text-small">
                          {t.lastUsedAtUnix ? timeAgo(t.lastUsedAtUnix * 1000) : "Never"}
                        </TableCell>
                        <TableCell>
                          <GrantPill status={status} />
                        </TableCell>
                        <TableCell>
                          {status === "active" && (
                            <fetcher.Form className="flex justify-end" method="post">
                              <input name="intent" type="hidden" value="revoke" />
                              <input name="id" type="hidden" value={t.id} />
                              <Button
                                aria-label={`Revoke the ${scope} token`}
                                className="border-danger text-danger"
                                size="sm"
                                type="submit"
                                variant="secondary"
                              >
                                Revoke
                              </Button>
                            </fetcher.Form>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Panel>
        </div>
        <Panel className={linked ? "border-primary" : undefined} title="Federated client">
          <span className="-mt-2 text-small text-muted">
            Let an OIDC client (client credentials from the gateway&apos;s own issuer) sign in as
            this account without a stored token. Its groups are the ones in its token&apos;s scope
            that are also allowed here.
          </span>
          <link.Form className="flex flex-col gap-4" method="post">
            <input name="intent" type="hidden" value="link" />
            {allowed.map((id) => (
              <input key={id} name="group" type="hidden" value={id} />
            ))}
            <Field
              hint={linked ? undefined : "Set by the gateway; it's filled in once linked."}
              label="Issuer"
            >
              <Input disabled mono value={account.oidcIssuer ?? "The gateway's issuer"} />
            </Field>
            <Field label="Client ID">
              <Input
                autoCapitalize="none"
                disabled={account.disabled}
                mono
                name="oidcSubject"
                onChange={(event) => setSubject(event.target.value)}
                placeholder="e.g. ci-runner"
                spellCheck={false}
                value={subject}
              />
            </Field>
            <div className="flex flex-col gap-2">
              <span className="text-[0.875rem] font-bold">Allowed groups</span>
              <GroupPicker
                groups={groups}
                label="Allowed groups"
                onChange={setAllowed}
                value={allowed}
              />
              <span className="text-small text-muted">
                None means the client signs in but gets no groups.
              </span>
            </div>
            {link.data && !link.data.ok && (
              <Alert tone="danger">{refusalMessage(link.data.refusal)}</Alert>
            )}
            {!account.disabled && (
              <div className="flex justify-end gap-2 border-t border-border pt-4">
                {linked && (
                  <Button
                    className="border-danger text-danger"
                    onClick={() => void link.submit({ intent: "unlink" }, { method: "post" })}
                    variant="secondary"
                  >
                    Unlink
                  </Button>
                )}
                <Button
                  disabled={!subject.trim()}
                  loading={link.state !== "idle"}
                  loadingLabel="Saving…"
                  type="submit"
                >
                  {linked ? "Save" : "Link client"}
                </Button>
              </div>
            )}
          </link.Form>
        </Panel>
      </div>

      <MintDialog groups={groups} onClose={() => setMinting(false)} open={minting} />

      <AlertDialog onOpenChange={setConfirmDisable} open={confirmDisable}>
        <AlertDialogContent>
          <AlertDialogTitle>Disable {account.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Every API token it has stops working at once, and so does its OIDC client. A disabled
            service account can&apos;t be turned back on.
          </AlertDialogDescription>
          <div className="flex justify-end gap-2.5">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void fetcher.submit({ intent: "disable" }, { method: "post" })}
            >
              Disable
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ServiceAccountDetail;

export const ErrorBoundary = () => (
  <PageError back="/service-accounts" backLabel="Back to service accounts" />
);
