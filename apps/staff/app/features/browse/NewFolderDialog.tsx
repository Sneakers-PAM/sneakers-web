import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
} from "@sneakers-web/ui";
import { useState } from "react";

import { DestinationList } from "@/features/browse/DestinationList";
import { creatableFolders, type NavFolder, TOP_LEVEL } from "@/features/browse/tree";
import { useBrowseAction } from "@/features/browse/useBrowseAction";

/**
 * D-05 New folder: a name and a parent picker, limited to folders the caller can create in and
 * defaulting to the folder the dialog was opened from. The shared top level is a site admin's
 * choice only, same as a move.
 */
export const NewFolderDialog = ({
  action,
  folders,
  isAdmin,
  onClose,
  parent,
}: {
  /** Where to post: the frame sidebar targets `/browse` explicitly, off the browse route. */
  action?: string;
  folders: NavFolder[];
  isAdmin: boolean;
  onClose: () => void;
  parent: NavFolder | null;
}) => {
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState(parent?.id ?? TOP_LEVEL);
  const { busy, error, submit } = useBrowseAction(onClose, action);
  const trimmed = name.trim();
  const target = parentId === TOP_LEVEL ? "" : parentId;

  return (
    <Dialog onOpenChange={(o) => !o && onClose()} open>
      <DialogContent className="max-w-[29rem]" hideClose>
        <form
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (trimmed) submit({ intent: "create", name: trimmed, parentId: target });
          }}
        >
          <DialogHeader>
            <DialogTitle>New folder</DialogTitle>
            <DialogDescription>Only folders you can manage are listed below.</DialogDescription>
          </DialogHeader>
          <Field label="Name">
            <Input maxLength={120} onChange={(event) => setName(event.target.value)} value={name} />
          </Field>
          <DestinationList
            destinations={creatableFolders(folders)}
            label="Location"
            onChange={setParentId}
            topLevel={isAdmin}
            value={parentId}
          />
          {error && <Alert tone="danger">{error}</Alert>}
          <DialogFooter>
            <Button onClick={onClose} type="button" variant="secondary">
              Cancel
            </Button>
            <Button disabled={!trimmed} loading={busy} loadingLabel="Create" type="submit">
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
