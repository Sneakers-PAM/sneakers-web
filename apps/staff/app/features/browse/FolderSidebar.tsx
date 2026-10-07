import { Button } from "@sneakers-web/ui";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useLocation, useMatches, useNavigate, useParams } from "react-router";

import type { NavFolder } from "@/features/browse/tree";

import { DeleteFolderDialog } from "@/features/browse/DeleteFolderDialog";
import { type FolderAction } from "@/features/browse/folderActions";
import { FolderNav } from "@/features/browse/FolderNav";
import { MoveFlow } from "@/features/browse/MoveFlow";
import { NameDialog } from "@/features/browse/NameDialog";
import { NewFolderDialog } from "@/features/browse/NewFolderDialog";
import { activeFolderId, folderLabel, reordered } from "@/features/browse/tree";
import { useBrowseAction } from "@/features/browse/useBrowseAction";

type Dialog =
  | { folder: NavFolder; kind: "delete" | "rename" }
  | { kind: "create"; parent: NavFolder | null }
  | { kind: "move"; subject: { folder: NavFolder; kind: "folder" } };

/**
 * U-03's folder tree, in the app shell's left main nav so it's there from any page, not just
 * `/browse`. Every mutation posts explicitly to `/browse`, or to the open folder's own path when
 * that's where we are (so deleting the folder you're viewing still gets its redirect), since this
 * sits outside that route and can't rely on the route in context.
 */
export const FolderSidebar = ({
  collapsed,
  folders,
  isAdmin,
}: {
  collapsed: boolean;
  folders: NavFolder[];
  isAdmin: boolean;
}) => {
  const { pathname } = useLocation();
  const { folderId } = useParams();
  const matches = useMatches();
  const currentId = activeFolderId(folderId, matches);
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const close = () => setDialog(null);
  const action = pathname.startsWith("/browse") ? pathname : "/browse";
  const { error, submit } = useBrowseAction(undefined, action);

  if (collapsed) return null;

  const onAction = (act: FolderAction, folder: NavFolder) => {
    switch (act) {
      case "create": {
        setDialog({ kind: "create", parent: folder });
        break;
      }
      case "delete":
      case "rename": {
        setDialog({ folder, kind: act });
        break;
      }
      case "down":
      case "up": {
        const ids = reordered(folders, folder.id, act);
        if (ids) {
          submit({ intent: "reorder", orderedIds: ids.join(","), parentId: folder.parentId ?? "" });
        }
        break;
      }
      case "move": {
        setDialog({ kind: "move", subject: { folder, kind: "folder" } });
        break;
      }
      case "sharing": {
        void navigate(`/folder/${folder.id}/sharing`);
        break;
      }
    }
  };

  return (
    <>
      <FolderNav currentId={currentId} folders={folders} onAction={onAction} />
      {isAdmin && (
        <Button
          block
          onClick={() => setDialog({ kind: "create", parent: null })}
          size="sm"
          variant="ghost"
        >
          <Plus aria-hidden />
          New shared folder
        </Button>
      )}
      {error && (
        <p className="px-3 text-small font-bold text-danger" role="alert">
          {error}
        </p>
      )}
      {dialog?.kind === "create" && (
        <NewFolderDialog
          action={action}
          folders={folders}
          isAdmin={isAdmin}
          onClose={close}
          parent={dialog.parent}
        />
      )}
      {dialog?.kind === "rename" && (
        <NameDialog
          action={action}
          description={
            <>
              Rename <b className="text-ink">{folderLabel(folders, dialog.folder)}</b>
            </>
          }
          fields={{ id: dialog.folder.id, intent: "rename" }}
          initial={dialog.folder.name}
          onClose={close}
          submitLabel="Save"
          title="Rename folder"
        />
      )}
      {dialog?.kind === "move" && (
        <MoveFlow
          action={action}
          folders={folders}
          isAdmin={isAdmin}
          onClose={close}
          subject={dialog.subject}
        />
      )}
      {dialog?.kind === "delete" && (
        <DeleteFolderDialog
          action={action}
          folder={dialog.folder}
          folders={folders}
          onClose={close}
        />
      )}
    </>
  );
};
