import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import {
  AdminFolderSettingsDocument,
  AdminSetFolderRevealStepUpDocument,
  BrowseCreateFolderDocument,
  BrowseDeleteFolderDocument,
  BrowseFoldersDocument,
  BrowseRenameFolderDocument,
  type StepUpMode,
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
  Card,
  cn,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Field,
  Input,
  PageHeader,
  plural,
  Segmented,
} from "@sneakers-web/ui";
import { ChevronDown, ChevronRight, Folder, FolderPlus, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, redirect, useFetcher, useLoaderData, useParams } from "react-router";

import { Choice, Panel, SettingRow, useResultToast } from "@/components/Admin";
import { PageError } from "@/components/PageError";
import { adminAct, adminLoad, text } from "@/lib/admin.server";

export const loader = ({ request }: LoaderFunctionArgs) =>
  adminLoad(request, async (gw) => {
    const [tree, extra] = await Promise.all([
      gw.gql(BrowseFoldersDocument),
      gw.gql(AdminFolderSettingsDocument),
    ]);
    const stepUp = Object.fromEntries(extra.folders.map((f) => [f.id, f.revealStepUp]));
    const names = Object.fromEntries(extra.users.map((u) => [u.id, u.name]));
    // The console manages shared folders. Personal folders belong to their owners.
    const folders = tree.folders
      .filter((f) => f.scope !== "personal")
      .map((f) => ({
        ...f,
        owners: f.owners ?? [],
        revealStepUp: stepUp[f.id] ?? ("inherit" as StepUpMode),
      }))
      .toSorted((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name));
    return { folders, globalStepUp: extra.securitySettings.requireMfaForReveal, names };
  });

/** Creating a folder opens it; deleting one opens the folder above. */
export const action = async ({ request }: ActionFunctionArgs) => {
  const form = await request.formData();
  const intent = text(form, "intent");
  return adminAct(request, intent, async (gw) => {
    switch (intent) {
      case "create": {
        const r = await gw.gql(BrowseCreateFolderDocument, {
          name: text(form, "name"),
          parentId: text(form, "parentId") || null,
        });
        throw redirect(`/folders/${r.createFolder.id}`);
      }
      case "delete": {
        await gw.gql(BrowseDeleteFolderDocument, {
          id: text(form, "id"),
          reassignToId: text(form, "reassignToId") || null,
        });
        const parentId = text(form, "parentId");
        throw redirect(parentId ? `/folders/${parentId}` : "/folders");
      }
      case "rename": {
        const r = await gw.gql(BrowseRenameFolderDocument, {
          id: text(form, "id"),
          name: text(form, "name"),
        });
        return `Renamed to ${r.renameFolder.name}.`;
      }
      case "step-up": {
        await gw.gql(AdminSetFolderRevealStepUpDocument, {
          folderId: text(form, "id"),
          mode: text(form, "mode") as StepUpMode,
        });
        return "Saved · reveal step-up.";
      }
    }
    throw new Error("unknown action");
  });
};

export const meta = () => [{ title: "Folders · Sneakers-PAM admin console" }];

type FolderRow = Awaited<ReturnType<typeof loader>>["folders"][number];

const Tree = ({
  folders,
  parentId,
  selected,
}: {
  folders: FolderRow[];
  parentId: null | string;
  selected?: string;
}) => {
  const children = folders.filter((f) => (f.parentId ?? null) === parentId);
  if (children.length === 0) return null;
  return (
    <ul
      className={cn(
        "m-0 flex list-none flex-col gap-0.5 p-0",
        parentId && "ml-4 border-l border-border pl-2",
      )}
    >
      {children.map((f) => (
        <Branch folder={f} folders={folders} key={f.id} selected={selected} />
      ))}
    </ul>
  );
};

const Branch = ({
  folder,
  folders,
  selected,
}: {
  folder: FolderRow;
  folders: FolderRow[];
  selected?: string;
}) => {
  const hasChildren = folders.some((f) => f.parentId === folder.id);
  const holdsSelected = (id?: string): boolean => {
    for (
      let f = folders.find((x) => x.id === id);
      f;
      f = folders.find((x) => x.id === f?.parentId)
    ) {
      if (f.parentId === folder.id) return true;
    }
    return false;
  };
  const [open, setOpen] = useState(holdsSelected(selected) || !folder.parentId);
  return (
    <li>
      <div className="flex items-center gap-1">
        {hasChildren ? (
          <button
            aria-expanded={open}
            aria-label={`${open ? "Collapse" : "Expand"} ${folder.name}`}
            className="inline-flex size-6 items-center justify-center rounded-xs text-muted hover:bg-sunken"
            onClick={() => setOpen((v) => !v)}
            type="button"
          >
            {open ? (
              <ChevronDown aria-hidden className="size-3.5" />
            ) : (
              <ChevronRight aria-hidden className="size-3.5" />
            )}
          </button>
        ) : (
          <span aria-hidden className="size-6" />
        )}
        <Link
          aria-current={selected === folder.id ? "page" : undefined}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2 rounded-sm px-2 py-1.5 text-[0.9375rem] font-bold text-ink no-underline hover:bg-sunken",
            selected === folder.id && "bg-primary-soft hover:bg-primary-soft",
          )}
          to={`/folders/${folder.id}`}
        >
          <Folder aria-hidden className="size-4 shrink-0 text-muted" />
          <span className="truncate">{folder.name}</span>
          <span className="ml-auto font-mono text-small font-normal text-muted">
            {folder.subtreeSecretCount ?? ""}
          </span>
        </Link>
      </div>
      {open && <Tree folders={folders} parentId={folder.id} selected={selected} />}
    </li>
  );
};

const STEP_UP: { label: string; value: StepUpMode }[] = [
  { label: "Inherit", value: "inherit" },
  { label: "Require", value: "require" },
  { label: "Off", value: "off" },
];

const Detail = ({
  folder,
  folders,
  globalStepUp,
  names,
}: {
  folder: FolderRow;
  folders: FolderRow[];
  globalStepUp: boolean;
  names: Record<string, string>;
}) => {
  const fetcher = useFetcher<typeof action>();
  const result = fetcher.data;
  useResultToast(result);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(folder.name);
  const [creating, setCreating] = useState(false);
  const [childName, setChildName] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [reassignTo, setReassignTo] = useState("");

  const byId = (id?: null | string) => folders.find((f) => f.id === id);
  const path: FolderRow[] = [];
  for (let f: FolderRow | undefined = folder; f; f = byId(f.parentId)) path.unshift(f);
  const below = new Set([folder.id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const f of folders) {
      if (f.parentId && below.has(f.parentId) && !below.has(f.id)) {
        below.add(f.id);
        grew = true;
      }
    }
  }
  const subfolders = folders.filter((f) => f.parentId === folder.id).length;
  const secrets = folder.subtreeSecretCount ?? 0;
  const targets = folders.filter((f) => !below.has(f.id));

  // What "inherit" means here: the nearest folder above that sets it, else the global setting.
  const inherited = (() => {
    for (let f = byId(folder.parentId); f; f = byId(f.parentId)) {
      if (f.revealStepUp !== "inherit") return { from: f.name, on: f.revealStepUp === "require" };
    }
    return { from: "the security settings", on: globalStepUp };
  })();

  const refusal = result && !result.ok ? result.refusal : undefined;

  return (
    <div className="flex flex-col gap-5">
      <Card className="flex flex-col gap-4 p-5.5">
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-small text-muted">{path.map((f) => f.name).join(" / ")}</span>
            {renaming ? (
              <fetcher.Form className="flex items-center gap-2" method="post">
                <input name="intent" type="hidden" value="rename" />
                <input name="id" type="hidden" value={folder.id} />
                <Input
                  aria-label="Folder name"

                  name="name"
                  onChange={(event) => setName(event.target.value)}
                  value={name}
                />
                <Button disabled={!name.trim()} size="sm" type="submit">
                  Save
                </Button>
                <Button
                  onClick={() => (setRenaming(false), setName(folder.name))}
                  size="sm"
                  variant="secondary"
                >
                  Cancel
                </Button>
              </fetcher.Form>
            ) : (
              <h2 className="m-0 font-display text-[1.5rem] font-bold">{folder.name}</h2>
            )}
          </div>
          <Badge className="mt-1" tone="sunken">
            {folder.scope === "role" ? `Role · ${folder.role ?? ""}` : "Group"}
          </Badge>
          {!renaming && (
            <span className="ml-auto flex flex-wrap gap-2">
              <Button onClick={() => setCreating(true)} size="sm" variant="secondary">
                <FolderPlus aria-hidden />
                New subfolder
              </Button>
              <Button onClick={() => setRenaming(true)} size="sm" variant="secondary">
                <Pencil aria-hidden />
                Rename
              </Button>
              <Button
                className="border-danger text-danger"
                onClick={() => setDeleting(true)}
                size="sm"
                variant="secondary"
              >
                <Trash2 aria-hidden />
                Delete…
              </Button>
            </span>
          )}
        </div>
        <dl className="m-0 flex flex-wrap gap-8">
          <div>
            <dt className="text-small text-muted">Secrets, here and below</dt>
            <dd className="m-0 font-display text-[1.25rem] font-bold">{secrets}</dd>
          </div>
          <div>
            <dt className="text-small text-muted">Subfolders</dt>
            <dd className="m-0 font-display text-[1.25rem] font-bold">{subfolders}</dd>
          </div>
          <div>
            <dt className="text-small text-muted">Owners</dt>
            <dd className="m-0 font-bold">
              {folder.owners.length > 0
                ? folder.owners.map((id) => names[id] ?? id).join(", ")
                : "Inherited from above"}
            </dd>
          </div>
        </dl>
        {refusal && <Alert tone="danger">{refusalMessage(refusal)}</Alert>}
      </Card>

      <Panel title="Reveal step-up">
        <SettingRow
          body={
            folder.revealStepUp === "inherit"
              ? `Inherits from ${inherited.from}: a fresh second factor is ${inherited.on ? "required" : "not required"} before a reveal here.`
              : folder.revealStepUp === "require"
                ? "A fresh second factor is required before anyone reveals or copies a sensitive field here or below."
                : "No step-up here or below, whatever the folders above say."
          }
          control={
            <Segmented<StepUpMode>
              className="w-max"
              label="Reveal step-up"
              onChange={(mode) =>
                void fetcher.submit({ id: folder.id, intent: "step-up", mode }, { method: "post" })
              }
              options={STEP_UP}
              size="sm"
              value={folder.revealStepUp}
            />
          }
          title="Ask for MFA before a reveal"
        />
      </Panel>

      <Dialog onOpenChange={setCreating} open={creating}>
        <DialogContent>
          <fetcher.Form className="flex flex-col gap-5" method="post">
            <input name="intent" type="hidden" value="create" />
            <input name="parentId" type="hidden" value={folder.id} />
            <DialogHeader>
              <DialogTitle>New folder in {folder.name}</DialogTitle>
            </DialogHeader>
            <Field label="Name">
              <Input
                name="name"
                onChange={(event) => setChildName(event.target.value)}
                value={childName}
              />
            </Field>
            {refusal && result?.intent === "create" && (
              <Alert tone="danger">{refusalMessage(refusal)}</Alert>
            )}
            <DialogFooter>
              <Button onClick={() => setCreating(false)} variant="secondary">
                Cancel
              </Button>
              <Button
                disabled={!childName.trim()}
                loading={fetcher.state !== "idle"}
                loadingLabel="Creating…"
                type="submit"
              >
                Create folder
              </Button>
            </DialogFooter>
          </fetcher.Form>
        </DialogContent>
      </Dialog>

      <AlertDialog onOpenChange={setDeleting} open={deleting}>
        <AlertDialogContent>
          <AlertDialogTitle>Delete {folder.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            {secrets > 0
              ? `It holds ${plural(secrets, "secret")}${subfolders > 0 ? ` and ${plural(subfolders, "subfolder")}` : ""}. Pick a folder to move them to first.`
              : subfolders > 0
                ? `Its ${plural(subfolders, "subfolder")} go with it. Nothing else is lost: it holds no secrets.`
                : "It's empty."}
          </AlertDialogDescription>
          {secrets > 0 && (
            <Field label="Move its contents to">
              <Choice
                label="Move its contents to"
                onChange={setReassignTo}
                options={targets.map((f) => ({ label: f.name, value: f.id }))}
                value={reassignTo}
              />
            </Field>
          )}
          <div className="flex justify-end gap-2.5">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={secrets > 0 && !reassignTo}
              onClick={() =>
                void fetcher.submit(
                  {
                    id: folder.id,
                    intent: "delete",
                    parentId: folder.parentId ?? "",
                    reassignToId: reassignTo,
                  },
                  { method: "post" },
                )
              }
            >
              Delete folder
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const NewTopFolder = () => {
  const fetcher = useFetcher<typeof action>();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const result = fetcher.data;
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <FolderPlus aria-hidden />
        New shared folder
      </Button>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent>
          <fetcher.Form className="flex flex-col gap-5" method="post">
            <input name="intent" type="hidden" value="create" />
            <DialogHeader>
              <DialogTitle>New shared folder</DialogTitle>
            </DialogHeader>
            <Field hint="A top-level folder. Only site admins can make one." label="Name">
              <Input name="name" onChange={(event) => setName(event.target.value)} value={name} />
            </Field>
            {result && !result.ok && <Alert tone="danger">{refusalMessage(result.refusal)}</Alert>}
            <DialogFooter>
              <Button onClick={() => setOpen(false)} variant="secondary">
                Cancel
              </Button>
              <Button
                disabled={!name.trim()}
                loading={fetcher.state !== "idle"}
                loadingLabel="Creating…"
                type="submit"
              >
                Create folder
              </Button>
            </DialogFooter>
          </fetcher.Form>
        </DialogContent>
      </Dialog>
    </>
  );
};

const Folders = () => {
  const { folders, globalStepUp, names } = useLoaderData<typeof loader>();
  const { id } = useParams();
  const selected = folders.find((f) => f.id === id);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        actions={<NewTopFolder key={id ?? "none"} />}
        eyebrow="Configuration · Folders"
        subtitle="Shared folders, their owners and reveal step-up. Personal folders belong to their owners and aren't managed here."
        title="Folders"
      />
      <div className="grid items-start gap-5 desktop:grid-cols-[18rem_minmax(0,1fr)]">
        <Card className="p-3">
          <nav aria-label="Shared folders">
            {folders.length === 0 ? (
              <p className="m-0 p-2 text-small text-muted">No shared folders yet.</p>
            ) : (
              <Tree folders={folders} parentId={null} selected={id} />
            )}
          </nav>
        </Card>
        {selected ? (
          <Detail
            folder={selected}
            folders={folders}
            globalStepUp={globalStepUp}
            key={`${selected.id}:${selected.name}`}
            names={names}
          />
        ) : (
          <EmptyState
            body={
              id
                ? "That folder doesn't exist, or it's someone's personal folder."
                : "Pick a folder to see its details and settings."
            }
            loader={false}
            title={id ? "Not found" : "Select a folder"}
          />
        )}
      </div>
    </div>
  );
};

export default Folders;

export const ErrorBoundary = () => <PageError />;
