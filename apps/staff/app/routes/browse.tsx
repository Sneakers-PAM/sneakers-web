import type { ActionFunctionArgs, LoaderFunctionArgs, MetaArgs } from "react-router";

import {
  Alert,
  Button,
  Card,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  PageHeader,
  plural,
} from "@sneakers-web/ui";
import { ChevronLeft, Ellipsis, Plus } from "lucide-react";
import { Fragment, useState } from "react";
import { Link, useLoaderData, useNavigate, useNavigation, useSearchParams } from "react-router";

import type { OpenFolder } from "@/features/browse/types";

import { browseAction, loadBrowse } from "@/features/browse/browse.server";
import { BrowseSkeleton } from "@/features/browse/BrowseSkeleton";
import { DeleteFolderDialog } from "@/features/browse/DeleteFolderDialog";
import { type FolderAction, folderActions } from "@/features/browse/folderActions";
import { FolderNav } from "@/features/browse/FolderNav";
import { MoveFlow, type MoveSubject } from "@/features/browse/MoveFlow";
import { NameDialog } from "@/features/browse/NameDialog";
import { NoAccess } from "@/features/browse/NoAccess";
import { SecretsTable } from "@/features/browse/SecretsTable";
import { folderLabel, isPersonal, type NavFolder, reordered } from "@/features/browse/tree";
import { useBrowseAction } from "@/features/browse/useBrowseAction";

export const loader = ({ params, request }: LoaderFunctionArgs) =>
  loadBrowse(request, params.folderId);

export const action = ({ params, request }: ActionFunctionArgs) =>
  browseAction(request, params.folderId);

export const meta = ({ data }: MetaArgs<typeof loader>) => [
  { title: `${data?.current?.folder.name ?? "Browse"} · Sneakers-PAM` },
];

type Dialog =
  | { folder: NavFolder; kind: "delete" | "rename" }
  | { kind: "create"; parent: NavFolder | null }
  | { kind: "move"; subject: MoveSubject };

const FolderPane = ({
  current,
  folders,
  includeRetired,
  onAction,
  onMoveSecrets,
}: {
  current: OpenFolder;
  folders: NavFolder[];
  includeRetired: boolean;
  onAction: (action: FolderAction, folder: NavFolder) => void;
  onMoveSecrets: (secrets: { id: string; name: string }[]) => void;
}) => {
  const [, setParameters] = useSearchParams();
  const { access, folder, path, secrets } = current;
  const personal = isPersonal(folder);
  const items = folder.canManage ? folderActions(folders, folder) : [];
  const live = secrets?.filter((s) => !s.retired).length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <Link
        className="inline-flex items-center gap-1 self-start text-body font-bold text-primary desktop:hidden"
        to="/browse"
      >
        <ChevronLeft aria-hidden className="size-4" />
        All folders
      </Link>
      <PageHeader
        actions={
          secrets && (
            <>
              <Button asChild variant="secondary">
                <Link to={`/folder/${folder.id}/sharing`}>Share</Link>
              </Button>
              {access.manage && (
                <Button asChild>
                  <Link to={`/secret/new?folderId=${folder.id}`}>
                    <Plus aria-hidden />
                    New secret
                  </Link>
                </Button>
              )}
              {items.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button aria-label="Folder actions" size="icon" variant="secondary">
                      <Ellipsis aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {items.map((item) => (
                      <Fragment key={item.action}>
                        {item.split && <DropdownMenuSeparator />}
                        <DropdownMenuItem
                          onSelect={() => onAction(item.action, folder)}
                          tone={item.tone}
                        >
                          {item.label}
                        </DropdownMenuItem>
                      </Fragment>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </>
          )
        }
        eyebrow={`Secret · ${path.join(" / ") || (personal ? "Personal" : "Shared")}`}
        subtitle={
          secrets ? `${plural(live, "secret")} · ${personal ? "personal" : "shared"} folder` : null
        }
        title={folder.name}
      />
      {personal && !folder.isMasterPersonal && (
        <Alert title="Private personal folder" tone="info">
          Only you can see the secrets in this folder and the folders inside it, unless you share
          them. If a site admin ever opens it in an emergency, you&apos;re told.
        </Alert>
      )}
      {secrets ? (
        <SecretsTable
          canManage={access.manage}
          folderId={folder.id}
          includeRetired={includeRetired}
          key={folder.id}
          onMove={onMoveSecrets}
          onShowRetired={(on) =>
            setParameters(on ? { retired: "1" } : {}, { preventScrollReset: true, replace: true })
          }
          secrets={secrets}
          types={current.types}
        />
      ) : (
        <NoAccess folder={folder.name} owners={current.owners} />
      )}
    </div>
  );
};

/** U-03 Browse: the folder tree beside the open folder's secrets, with every folder change. */
const Browse = () => {
  const { current, folders, includeRetired, isAdmin } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const order = useBrowseAction();
  const currentId = current?.folder.id;
  // A dialog belongs to the folder it was opened on; opening another folder drops it.
  const [dialog, setDialog] = useState<({ at?: string } & Dialog) | null>(null);
  const open = (d: Dialog) => setDialog({ ...d, at: currentId });
  const close = () => setDialog(null);
  const shown = dialog && dialog.at === currentId ? dialog : null;
  const loading =
    navigation.state === "loading" && navigation.location.pathname.startsWith("/browse");

  const onAction = (act: FolderAction, folder: NavFolder) => {
    switch (act) {
      case "create": {
        open({ kind: "create", parent: folder });
        break;
      }
      case "delete":
      case "rename": {
        open({ folder, kind: act });
        break;
      }
      case "down":
      case "up": {
        const ids = reordered(folders, folder.id, act);
        if (ids) {
          order.submit({
            intent: "reorder",
            orderedIds: ids.join(","),
            parentId: folder.parentId ?? "",
          });
        }
        break;
      }
      case "move": {
        open({ kind: "move", subject: { folder, kind: "folder" } });
        break;
      }
      case "sharing": {
        void navigate(`/folder/${folder.id}/sharing`);
        break;
      }
    }
  };

  if (folders.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader eyebrow="Secrets" title="Browse" />
        <EmptyState
          action={
            isAdmin && (
              <Button onClick={() => open({ kind: "create", parent: null })}>
                New shared folder
              </Button>
            )
          }
          body="Folders you can see show up here. Shared folders are made by a site admin."
          title="No folders yet"
        />
        {shown?.kind === "create" && (
          <NameDialog
            description="At the top of the shared folders."
            fields={{ intent: "create", parentId: "" }}
            onClose={close}
            submitLabel="Create"
            title="New folder"
          />
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-6 desktop:grid-cols-[17rem_minmax(0,1fr)] desktop:items-start">
      <Card className={current ? "hidden p-2 desktop:block" : "p-2"}>
        <FolderNav
          currentId={currentId}
          folders={folders}
          key={currentId ?? "none"}
          onAction={onAction}
        />
        {isAdmin && (
          <Button
            block
            className="mt-2"
            onClick={() => open({ kind: "create", parent: null })}
            size="sm"
            variant="ghost"
          >
            <Plus aria-hidden />
            New shared folder
          </Button>
        )}
      </Card>
      <section className={current ? "min-w-0" : "hidden min-w-0 desktop:block"}>
        {loading ? (
          <BrowseSkeleton />
        ) : current ? (
          <FolderPane
            current={current}
            folders={folders}
            includeRetired={includeRetired}
            onAction={onAction}
            onMoveSecrets={(secrets) =>
              open({ kind: "move", subject: { from: current.folder, kind: "secrets", secrets } })
            }
          />
        ) : (
          <div className="flex flex-col gap-6">
            <PageHeader eyebrow="Secrets" title="Browse" />
            <EmptyState
              body="Choose a folder on the left to see its secrets."
              title="Pick a folder"
            />
          </div>
        )}
      </section>
      {order.error && (
        <p className="text-small font-bold text-danger desktop:col-span-2" role="alert">
          {order.error}
        </p>
      )}
      {shown?.kind === "create" && (
        <NameDialog
          description={
            shown.parent ? (
              <>
                In <b className="text-ink">{folderLabel(folders, shown.parent)}</b>
              </>
            ) : (
              "At the top of the shared folders."
            )
          }
          fields={{ intent: "create", parentId: shown.parent?.id ?? "" }}
          onClose={close}
          submitLabel="Create"
          title="New folder"
        />
      )}
      {shown?.kind === "rename" && (
        <NameDialog
          description={
            <>
              Rename <b className="text-ink">{folderLabel(folders, shown.folder)}</b>
            </>
          }
          fields={{ id: shown.folder.id, intent: "rename" }}
          initial={shown.folder.name}
          onClose={close}
          submitLabel="Save"
          title="Rename folder"
        />
      )}
      {shown?.kind === "move" && (
        <MoveFlow folders={folders} isAdmin={isAdmin} onClose={close} subject={shown.subject} />
      )}
      {shown?.kind === "delete" && (
        <DeleteFolderDialog folder={shown.folder} folders={folders} onClose={close} />
      )}
    </div>
  );
};

export default Browse;

export { BrowseError as ErrorBoundary } from "@/features/browse/BrowseError";
