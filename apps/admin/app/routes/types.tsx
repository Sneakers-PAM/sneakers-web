import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import {
  AdminCloneSecretTypeDocument,
  AdminDeleteSecretTypeDocument,
  AdminImportExtensionDocument,
  AdminImportExtensionFromJsonDocument,
  AdminSecretTypesDocument,
} from "@sneakers-web/api-client";
import {
  Badge,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  PageHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  Textarea,
} from "@sneakers-web/ui";
import { ArrowLeftRight, Check, Heart, Plus, RefreshCw, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useFetcher, useLoaderData, useNavigate } from "react-router";

import { useResultToast } from "@/components/Admin";
import { PageError } from "@/components/PageError";
import { adminAct, adminLoad, text } from "@/lib/admin.server";
import { jsonProblem } from "@/lib/json";

export const loader = ({ request }: LoaderFunctionArgs) =>
  adminLoad(request, async (gw) => {
    const d = await gw.gql(AdminSecretTypesDocument);
    return {
      packs: d.availableExtensions,
      types: d.secretTypes.toSorted((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      ),
    };
  });

/** "clone" answers the new type's id in `done`, so the page can open it. */
export const action = async ({ request }: ActionFunctionArgs) => {
  const form = await request.formData();
  const intent = text(form, "intent");
  const id = text(form, "id");
  const name = text(form, "name");
  return adminAct(request, intent, async (gw) => {
    switch (intent) {
      case "clone": {
        const r = await gw.gql(AdminCloneSecretTypeDocument, { id });
        return r.cloneSecretType.id;
      }
      case "delete": {
        await gw.gql(AdminDeleteSecretTypeDocument, { id });
        return `${text(form, "verb")} ${name}.`;
      }
      case "import-json": {
        const r = await gw.gql(AdminImportExtensionFromJsonDocument, {
          json: String(form.get("json") ?? ""),
        });
        return `Imported ${r.importExtensionFromJson.name}.`;
      }
      case "install": {
        const r = await gw.gql(AdminImportExtensionDocument, { id });
        return `Installed ${r.importExtension.name}.`;
      }
    }
    throw new Error("unknown action");
  });
};

export const meta = () => [{ title: "Secret types · Sneakers-PAM admin console" }];

const SOURCE = {
  custom: <Badge tone="primary">Custom</Badge>,
  system: <Badge tone="neutral">Built-in</Badge>,
};

const Capability = ({ icon, label }: { icon: React.ReactNode; label: string }) => (
  <span className="inline-flex items-center gap-1 rounded-xs border-[1.5px] border-ink px-1.5 py-0.5 text-[0.75rem] font-bold [&_svg]:size-3">
    {icon}
    {label}
  </span>
);

const ImportDialog = ({
  onClose,
  open,
  packs,
}: {
  onClose: () => void;
  open: boolean;
  packs: { fields: { label: string }[]; id: string; name: string; vendor?: null | string }[];
}) => {
  const fetcher = useFetcher<typeof action>();
  useResultToast(fetcher.data);
  const [json, setJson] = useState("");
  const problem = json.trim() ? jsonProblem(json) : null;
  const done = fetcher.data?.ok && fetcher.data.intent === "import-json";
  useEffect(() => {
    if (done) onClose();
  }, [done, onClose]);
  return (
    <Dialog onOpenChange={(o) => !o && onClose()} open={open}>
      <DialogContent className="max-w-[37.5rem]">
        <DialogHeader>
          <DialogTitle>Import extension pack</DialogTitle>
          <DialogDescription>
            Packs add vendor-specific types. They are read-only and can be uninstalled.
          </DialogDescription>
        </DialogHeader>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {packs.length === 0 && (
            <li className="text-small text-muted">Every available pack is installed.</li>
          )}
          {packs.map((p) => (
            <li
              className="flex items-center gap-3 rounded-lg border border-border px-4 py-3"
              key={p.id}
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <b>{p.name}</b>
                <span className="truncate text-small text-muted">
                  {p.fields.map((f) => f.label).join(", ")}
                </span>
              </span>
              <fetcher.Form method="post">
                <input name="intent" type="hidden" value="install" />
                <input name="id" type="hidden" value={p.id} />
                <Button aria-label={`Install ${p.name}`} size="sm" type="submit">
                  Install
                </Button>
              </fetcher.Form>
            </li>
          ))}
        </ul>
        <fetcher.Form className="flex flex-col gap-2" method="post">
          <input name="intent" type="hidden" value="import-json" />
          <Label htmlFor="pack-json">Or paste a pack</Label>
          <Textarea
            aria-describedby={problem ? "pack-json-problem" : undefined}
            aria-invalid={problem ? true : undefined}
            id="pack-json"
            mono
            name="json"
            onChange={(event) => setJson(event.target.value)}
            placeholder={'{\n  "name": "Acme Switch",\n  "vendor": "Acme",\n  "fields": [ … ]\n}'}
            value={json}
          />
          {problem && (
            <span
              className="flex items-center gap-1 text-small font-bold text-danger"
              id="pack-json-problem"
              role="alert"
            >
              <X aria-hidden className="size-3.5" strokeWidth={3} />
              {problem}
            </span>
          )}
          <DialogFooter>
            <Button onClick={onClose} variant="secondary">
              Cancel
            </Button>
            <Button
              disabled={!json.trim() || !!problem}
              loading={fetcher.state !== "idle"}
              loadingLabel="Importing…"
              type="submit"
            >
              Import
            </Button>
          </DialogFooter>
        </fetcher.Form>
      </DialogContent>
    </Dialog>
  );
};

const Types = () => {
  const { packs, types } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const navigate = useNavigate();
  const [importing, setImporting] = useState(false);
  const cloned = fetcher.data?.ok && fetcher.data.intent === "clone" ? fetcher.data.done : null;
  useResultToast(fetcher.data?.intent === "clone" && fetcher.data.ok ? undefined : fetcher.data);
  useEffect(() => {
    if (cloned) void navigate(`/types/${cloned}`);
  }, [cloned, navigate]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        actions={
          <>
            <Button onClick={() => setImporting(true)} variant="secondary">
              Import extension pack…
            </Button>
            <Button asChild>
              <Link to="/types/new">
                <Plus aria-hidden />
                New type
              </Link>
            </Button>
          </>
        }
        eyebrow="Configuration · Types"
        subtitle="A type decides which fields a secret has and what it can do."
        title="Secret types"
      />
      <div className="flex flex-col gap-2">
        <Card>
          <Table>
            <TableHead>
              <tr>
                <TableHeaderCell>Type</TableHeaderCell>
                <TableHeaderCell>Source</TableHeaderCell>
                <TableHeaderCell>Fields</TableHeaderCell>
                <TableHeaderCell>Capabilities</TableHeaderCell>
                <TableHeaderCell>
                  <span className="sr-only">Actions</span>
                </TableHeaderCell>
              </tr>
            </TableHead>
            <TableBody>
              {types.map((t) => {
                const custom = t.origin === "custom";
                const verb = t.origin === "extension" ? "Uninstall" : "Delete";
                return (
                  <TableRow key={t.id}>
                    <TableCell>
                      <Link className="font-bold" to={`/types/${t.id}`}>
                        {t.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {t.origin === "extension" ? (
                        <Badge tone="warn">Extension · {t.vendor ?? "pack"}</Badge>
                      ) : (
                        SOURCE[t.origin]
                      )}
                    </TableCell>
                    <TableCell className="font-mono">{t.fields.length}</TableCell>
                    <TableCell>
                      <span className="flex flex-wrap gap-1">
                        {t.heartbeat && (
                          <Capability
                            icon={<Heart aria-hidden fill="currentColor" />}
                            label="Heartbeat"
                          />
                        )}
                        {t.rotation && (
                          <Capability icon={<RefreshCw aria-hidden />} label="Rotation" />
                        )}
                        {t.checkout && (
                          <Capability icon={<ArrowLeftRight aria-hidden />} label="Checkout" />
                        )}
                        {!t.heartbeat && !t.rotation && !t.checkout && (
                          <span className="text-muted">—</span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="flex justify-end gap-2">
                        <Button asChild size="sm" variant="secondary">
                          <Link
                            aria-label={`${custom ? "Edit" : "View"} ${t.name}`}
                            to={`/types/${t.id}`}
                          >
                            {custom ? "Edit" : "View"}
                          </Link>
                        </Button>
                        <fetcher.Form method="post">
                          <input name="intent" type="hidden" value="clone" />
                          <input name="id" type="hidden" value={t.id} />
                          <Button
                            aria-label={`Clone ${t.name}`}
                            size="sm"
                            type="submit"
                            variant="secondary"
                          >
                            Clone
                          </Button>
                        </fetcher.Form>
                        {t.origin !== "system" && (
                          <fetcher.Form method="post">
                            <input name="intent" type="hidden" value="delete" />
                            <input name="id" type="hidden" value={t.id} />
                            <input name="name" type="hidden" value={t.name} />
                            <input
                              name="verb"
                              type="hidden"
                              value={verb === "Uninstall" ? "Uninstalled" : "Deleted"}
                            />
                            <Button
                              aria-label={`${verb} ${t.name}`}
                              className="border-danger text-danger"
                              size="sm"
                              type="submit"
                              variant="secondary"
                            >
                              {verb}
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
        <p className="m-0 flex items-center gap-1.5 text-small text-muted">
          <Check aria-hidden className="size-3.5" />
          Built-in types can be cloned, not changed. Delete and Uninstall are refused while secrets
          use the type.
        </p>
      </div>
      <ImportDialog onClose={() => setImporting(false)} open={importing} packs={packs} />
    </div>
  );
};

export default Types;

export const ErrorBoundary = () => <PageError />;
