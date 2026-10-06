import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import {
  AdminConnectionsDocument,
  AdminDeleteConnectionDocument,
  AdminSaveConnectionDocument,
} from "@sneakers-web/api-client";
import { refusalMessage } from "@sneakers-web/shell";
import {
  Alert,
  Button,
  Card,
  cn,
  Field,
  Input,
  PageHeader,
  plural,
  Switch,
  Tooltip,
} from "@sneakers-web/ui";
import { Info, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useFetcher, useLoaderData } from "react-router";

import { Choice, useResultToast } from "@/components/Admin";
import { PageError } from "@/components/PageError";
import { adminAct, adminLoad, text } from "@/lib/admin.server";
import { listOf, protocolChoices, protocolOf } from "@/lib/protocols";

export const loader = ({ request }: LoaderFunctionArgs) =>
  adminLoad(request, async (gw) => {
    const d = await gw.gql(AdminConnectionsDocument);
    return {
      connections: d.connections.toSorted((a, b) => a.name.localeCompare(b.name)),
      targets: d.targets,
    };
  });

export const action = async ({ request }: ActionFunctionArgs) => {
  const form = await request.formData();
  const intent = text(form, "intent");
  return adminAct(request, intent, async (gw) => {
    if (intent === "delete") {
      await gw.gql(AdminDeleteConnectionDocument, { id: text(form, "id") });
      return `Deleted ${text(form, "name")}.`;
    }
    const port = text(form, "port");
    const r = await gw.gql(AdminSaveConnectionDocument, {
      input: {
        description: text(form, "description") || null,
        id: text(form, "id") || null,
        name: text(form, "name"),
        port: port ? Number(port) : null,
        protocol: text(form, "protocol"),
        useTls: form.get("useTls") === "on",
      },
    });
    return `Saved ${r.saveConnection.name}.`;
  });
};

export const meta = () => [{ title: "Connections · Sneakers-PAM admin console" }];

type Connection = Awaited<ReturnType<typeof loader>>["connections"][number];

interface Draft {
  description: string;
  name: string;
  port: string;
  protocol: string;
  useTls: boolean;
}

const draftOf = (c?: Connection): Draft => ({
  description: c?.description ?? "",
  name: c?.name ?? "",
  port: c?.port ? String(c.port) : "22",
  protocol: c?.protocol ?? "ssh",
  useTls: !!c?.useTls,
});

const usageText = (usedBy: string[]): string =>
  usedBy.length > 0 ? `Used by ${plural(usedBy.length, "target")}` : "Not used by any target";

const ConnectionCard = ({
  connection,
  onBlocked,
  onDone,
  usedBy,
}: {
  connection?: Connection;
  onBlocked: (names: string[]) => void;
  onDone?: () => void;
  usedBy: string[];
}) => {
  const fetcher = useFetcher<typeof action>();
  useResultToast(fetcher.data);
  const saved = draftOf(connection);
  const [d, setD] = useState<Draft>(saved);
  const set = (patch: Partial<Draft>) => setD((current) => ({ ...current, ...patch }));
  const dirty = !connection || JSON.stringify(d) !== JSON.stringify(saved);
  const id = connection?.id ?? "new";
  const label = connection?.name ?? "the new connection";
  const problem = d.name.trim() ? undefined : "Give it a name.";
  const portProblem =
    d.port && (Number(d.port) < 1 || Number(d.port) > 65_535) ? "1 to 65535." : undefined;
  const refusal = fetcher.data && !fetcher.data.ok ? fetcher.data.refusal : undefined;
  const savedNew = !connection && fetcher.data?.ok && fetcher.data.intent === "save";
  useEffect(() => {
    if (savedNew) onDone?.();
  }, [savedNew, onDone]);

  return (
    <Card className={cn("p-4.5", dirty && connection && "border-primary")}>
      <fetcher.Form
        aria-label={connection ? `Connection ${connection.name}` : "New connection"}
        className="flex flex-wrap items-end gap-4"
        method="post"
      >
        <input name="intent" type="hidden" value="save" />
        {connection && <input name="id" type="hidden" value={connection.id} />}
        <Field
          className="min-w-44 flex-1"
          error={connection || d.name ? problem : undefined}
          label="Name"
        >
          <Input
            id={`c-${id}-name`}
            name="name"
            onChange={(event) => set({ name: event.target.value })}
            value={d.name}
          />
        </Field>
        <Field className="min-w-44 flex-1" label="Protocol">
          <Choice
            name="protocol"
            onChange={(protocol) => {
              const known = protocolOf(protocol);
              set({ protocol, ...(known ? { port: String(known.port), useTls: known.tls } : {}) });
            }}
            options={protocolChoices(d.protocol)}
            value={d.protocol}
          />
        </Field>
        <Field className="min-w-24 flex-1" error={portProblem} label="Port">
          <Input
            mono
            name="port"
            onChange={(event) => set({ port: event.target.value })}
            type="number"
            value={d.port}
          />
        </Field>
        <div className="flex flex-col gap-2">
          <span className="text-[0.875rem] font-bold" id={`c-${id}-tls`}>
            TLS
          </span>
          <Switch
            aria-labelledby={`c-${id}-tls`}
            checked={d.useTls}
            className="my-2"
            name="useTls"
            onCheckedChange={(useTls) => set({ useTls })}
          />
        </div>
        <Field className="min-w-52 flex-1" label="Description">
          <Input
            name="description"
            onChange={(event) => set({ description: event.target.value })}
            placeholder="Optional"
            value={d.description}
          />
        </Field>
        <div className="ml-auto flex flex-col items-end gap-2">
          {connection && (
            <Tooltip content={usageText(usedBy)}>
              <button
                aria-label={usageText(usedBy)}
                className="inline-flex size-7 items-center justify-center rounded-full text-muted hover:bg-sunken hover:text-ink"
                type="button"
              >
                <Info aria-hidden className="size-4" />
              </button>
            </Tooltip>
          )}
          <span className="flex gap-2">
            {dirty && (
              <Button
                aria-label={`Save ${label}`}
                disabled={!!problem || !!portProblem}
                loading={fetcher.state !== "idle" && fetcher.formData?.get("intent") === "save"}
                loadingLabel="Saving…"
                size="sm"
                type="submit"
              >
                Save
              </Button>
            )}
            {connection ? (
              usedBy.length > 0 ? (
                <Button
                  aria-label={`Delete ${label}`}
                  className="bg-sunken text-muted hover:bg-sunken"
                  onClick={() => onBlocked(usedBy)}
                  size="sm"
                  variant="ghost"
                >
                  Delete
                </Button>
              ) : (
                <Button
                  aria-label={`Delete ${label}`}
                  className="border-danger text-danger"
                  onClick={() =>
                    void fetcher.submit(
                      { id: connection.id, intent: "delete", name: connection.name },
                      { method: "post" },
                    )
                  }
                  size="sm"
                  variant="secondary"
                >
                  Delete
                </Button>
              )
            ) : (
              <Button onClick={onDone} size="sm" variant="secondary">
                Cancel
              </Button>
            )}
          </span>
        </div>
      </fetcher.Form>
      {refusal && (
        <p className="m-0 mt-3 text-small font-bold text-danger" role="alert">
          {refusalMessage(refusal)}
        </p>
      )}
    </Card>
  );
};

const Connections = () => {
  const { connections, targets } = useLoaderData<typeof loader>();
  const [adding, setAdding] = useState(false);
  const [blocked, setBlocked] = useState<{ name: string; targets: string[] } | null>(null);
  const usedBy = (id: string) => targets.filter((t) => t.connectionId === id).map((t) => t.name);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        actions={
          <Button disabled={adding} onClick={() => setAdding(true)}>
            <Plus aria-hidden />
            Add connection
          </Button>
        }
        eyebrow="Configuration · Connections"
        subtitle="How Sneakers-PAM reaches targets. A target picks one and adds its hostname. Picking a protocol fills its default port."
        title="Connections"
      />
      <div className="flex flex-col gap-3">
        {adding && (
          <ConnectionCard onBlocked={() => {}} onDone={() => setAdding(false)} usedBy={[]} />
        )}
        {connections.map((c) => (
          <ConnectionCard
            connection={c}
            key={`${c.id}:${c.name}:${c.protocol}:${c.port}:${c.useTls}:${c.description}`}
            onBlocked={(names) => setBlocked({ name: c.name, targets: names })}
            usedBy={usedBy(c.id)}
          />
        ))}
        {connections.length === 0 && !adding && (
          <p className="m-0 text-muted">No connections yet. Add the first one.</p>
        )}
      </div>
      {blocked && (
        <Alert role="alert" title="Delete blocked" tone="danger">
          {blocked.name} is used by {listOf(blocked.targets)}. Move them to another connection
          first.
        </Alert>
      )}
    </div>
  );
};

export default Connections;

export const ErrorBoundary = () => <PageError />;
