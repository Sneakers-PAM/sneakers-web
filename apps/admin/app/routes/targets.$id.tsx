import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import {
  AdminSaveTargetDocument,
  AdminTargetsDocument,
  GraphQLRequestError,
} from "@sneakers-web/api-client";
import { HostKeyPinDialog, type Refusal, refusalMessage, refusalOf } from "@sneakers-web/shell";
import { guard, isAdmin, requireUser } from "@sneakers-web/shell/server";
import { Alert, Button, Field, Input, PageHeader, plural, Textarea } from "@sneakers-web/ui";
import { useState } from "react";
import {
  data,
  Form,
  Link,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
} from "react-router";

import { Choice, Panel } from "@/components/Admin";
import { PageError } from "@/components/PageError";
import { adminLoad, text } from "@/lib/admin.server";
import { pinProblems } from "@/lib/pins";

export interface TargetDraft {
  connectionId: string;
  description: string;
  domain: string;
  hostname: string;
  kind: string;
  name: string;
  realm: string;
  sshHostKeys: string;
}

export const loader = ({ params, request }: LoaderFunctionArgs) =>
  adminLoad(request, async (gw, user) => {
    const d = await gw.gql(AdminTargetsDocument);
    const connections = d.connections.map((c) => ({
      label: `${c.name} (${c.protocol}${c.port ? `:${c.port}` : ""})`,
      protocol: c.protocol,
      value: c.id,
    }));
    if (!params.id) {
      const draft: TargetDraft = {
        connectionId: connections[0]?.value ?? "",
        description: "",
        domain: "",
        hostname: "",
        kind: "",
        name: "",
        realm: "",
        sshHostKeys: "",
      };
      return { canPinHostKey: isAdmin(user), connections, draft, target: null };
    }
    const t = d.targets.find((x) => x.id === params.id);
    if (!t)
      throw new GraphQLRequestError([
        { extensions: { code: "NOT_FOUND" }, message: "target not found" },
      ]);
    const draft: TargetDraft = {
      connectionId: t.connectionId,
      description: t.description ?? "",
      domain: t.domain ?? "",
      hostname: t.hostname,
      kind: t.kind ?? "",
      name: t.name,
      realm: t.realm ?? "",
      sshHostKeys: t.sshHostKeys.join("\n"),
    };
    return {
      canPinHostKey: isAdmin(user),
      connections,
      draft,
      target: { id: t.id, ownerUserId: t.ownerUserId, secretCount: t.secretCount },
    };
  });

const lines = (v: string) =>
  v
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

export const action = async ({ params, request }: ActionFunctionArgs) => {
  const { gw } = await requireUser(request);
  const form = await request.formData();
  const draft: TargetDraft = {
    connectionId: text(form, "connectionId"),
    description: text(form, "description"),
    domain: text(form, "domain"),
    hostname: text(form, "hostname"),
    kind: text(form, "kind"),
    name: text(form, "name"),
    realm: text(form, "realm"),
    sshHostKeys: String(form.get("sshHostKeys") ?? ""),
  };
  return guard(request, async () => {
    try {
      await gw.gql(AdminSaveTargetDocument, {
        input: {
          connectionId: draft.connectionId,
          description: draft.description || null,
          domain: draft.domain || null,
          hostname: draft.hostname,
          id: params.id ?? null,
          kind: draft.kind || null,
          name: draft.name,
          realm: draft.realm || null,
          sshHostKeys: lines(draft.sshHostKeys),
        },
      });
      throw redirect("/targets");
    } catch (error) {
      const refusal = refusalOf(error);
      if (!refusal) throw error;
      return data<{ draft: TargetDraft; refusal: Refusal }>({ draft, refusal }, { status: 400 });
    }
  });
};

export const meta = ({ data: d }: { data?: Awaited<ReturnType<typeof loader>> }) => [
  { title: `${d?.draft.name || "New target"} · Sneakers-PAM admin console` },
];

/** Labels people use for a target. The connector doesn't read it; the protocol picks the adapter. */
const KINDS = ["active-directory", "linux", "windows", "network", "postgres"];

const TargetEditor = () => {
  const { canPinHostKey, connections, draft: saved, target } = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const busy = useNavigation().state === "submitting";
  const [d, setD] = useState<TargetDraft>(result?.draft ?? saved);
  const [tried, setTried] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const set = (patch: Partial<TargetDraft>) => setD((current) => ({ ...current, ...patch }));
  const protocol = connections.find((c) => c.value === d.connectionId)?.protocol ?? "";
  const ssh = protocol === "ssh";
  const pins = pinProblems(d.sshHostKeys);
  const problems = {
    connectionId: d.connectionId
      ? undefined
      : "Pick a connection. Add one under Connections first.",
    hostname: d.hostname.trim() ? undefined : "Give the hostname or address.",
    name: d.name.trim() ? undefined : "Give the target a name.",
  };
  const blocked = Object.values(problems).some(Boolean) || pins.length > 0;
  const show = tried || !!result;

  return (
    <Form
      className="flex flex-col gap-6"
      method="post"
      onSubmit={(event) => {
        setTried(true);
        if (blocked) event.preventDefault();
      }}
    >
      <PageHeader
        actions={
          <>
            <Button asChild variant="secondary">
              <Link to="/targets">Cancel</Link>
            </Button>
            <Button loading={busy} loadingLabel="Saving…" type="submit">
              {target ? "Save target" : "Create target"}
            </Button>
          </>
        }
        eyebrow="Configuration · Targets"
        subtitle={
          target
            ? `${target.ownerUserId ? "Personal target" : "Shared target"} · ${plural(target.secretCount, "secret")} ${target.secretCount === 1 ? "points" : "point"} at it`
            : "A system Sneakers-PAM checks and rotates on. It binds to a connection and adds its own hostname."
        }
        title={d.name.trim() || "New target"}
      />
      {result?.refusal && (
        <Alert title="Couldn't save the target" tone="danger">
          {refusalMessage(result.refusal)}
        </Alert>
      )}
      <Panel title="Details">
        <div className="grid gap-4 tablet:grid-cols-2">
          <Field error={show ? problems.name : undefined} label="Name" required>
            <Input
              name="name"
              onChange={(event) => set({ name: event.target.value })}
              placeholder="e.g. Corp directory"
              value={d.name}
            />
          </Field>
          <Field error={show ? problems.hostname : undefined} label="Hostname" required>
            <Input
              autoCapitalize="none"
              mono
              name="hostname"
              onChange={(event) => set({ hostname: event.target.value })}
              placeholder="e.g. dc1.corp.example.org"
              spellCheck={false}
              value={d.hostname}
            />
          </Field>
          <Field error={show ? problems.connectionId : undefined} label="Connection" required>
            <Choice
              name="connectionId"
              onChange={(connectionId) => set({ connectionId })}
              options={connections}
              value={d.connectionId}
            />
          </Field>
          <Field
            hint="A label for people; the connection's protocol decides how it's reached."
            label="Kind"
          >
            <Input
              list="target-kinds"
              name="kind"
              onChange={(event) => set({ kind: event.target.value })}
              placeholder="e.g. active-directory"
              value={d.kind}
            />
          </Field>
          <datalist id="target-kinds">
            {KINDS.map((k) => (
              <option key={k} value={k} />
            ))}
          </datalist>
        </div>
        <Field label="Description">
          <Input
            name="description"
            onChange={(event) => set({ description: event.target.value })}
            placeholder="Optional notes about this host"
            value={d.description}
          />
        </Field>
      </Panel>
      <Panel title="Directory and Kerberos">
        <span className="-mt-2 text-small text-muted">
          For LDAP: a DNS domain (ad.example.org) means Active Directory; a DN (dc=example,dc=org)
          means an lldap-style directory. Kerberos uses the realm, or the domain upper-cased.
        </span>
        <div className="grid gap-4 tablet:grid-cols-2">
          <Field label="Domain">
            <Input
              mono
              name="domain"
              onChange={(event) => set({ domain: event.target.value })}
              placeholder="e.g. corp.example.org"
              value={d.domain}
            />
          </Field>
          <Field label="Realm">
            <Input
              mono
              name="realm"
              onChange={(event) => set({ realm: event.target.value })}
              placeholder="If different from the domain"
              value={d.realm}
            />
          </Field>
        </div>
      </Panel>
      <Panel title="SSH host keys">
        <span className="-mt-2 text-small text-muted">
          One OpenSSH public key per line, as in known_hosts or authorized_keys (ssh-ed25519 AAAA…
          comment). Sessions and heartbeats only go to a host that presents one of these.
        </span>
        {ssh && lines(d.sshHostKeys).length === 0 && (
          <Alert tone="warn">
            This is an SSH target with no pinned key, so the connector and the SSH broker will
            refuse it.
          </Alert>
        )}
        <Field error={pins.join(" ") || undefined} label="Pinned keys">
          <Textarea
            className="min-h-28"
            mono
            name="sshHostKeys"
            onChange={(event) => set({ sshHostKeys: event.target.value })}
            placeholder="ssh-ed25519 AAAAC3Nza… host1"
            spellCheck={false}
            value={d.sshHostKeys}
          />
        </Field>
        {ssh && target && (
          <>
            {canPinHostKey ? (
              <Button
                className="self-start"
                onClick={() => setPinOpen(true)}
                type="button"
                variant="secondary"
              >
                Scan and pin…
              </Button>
            ) : (
              <span className="text-small text-muted">
                Ask a site admin to scan and pin this host&apos;s key.
              </span>
            )}
          </>
        )}
      </Panel>
      {target && (
        <HostKeyPinDialog
          hostname={d.hostname}
          onOpenChange={setPinOpen}
          onPinned={(publicKey) => {
            if (!lines(d.sshHostKeys).includes(publicKey)) {
              set({ sshHostKeys: [...lines(d.sshHostKeys), publicKey].join("\n") });
            }
          }}
          open={pinOpen}
          targetId={target.id}
        />
      )}
    </Form>
  );
};

export default TargetEditor;

export const ErrorBoundary = () => <PageError back="/targets" backLabel="Back to targets" />;
