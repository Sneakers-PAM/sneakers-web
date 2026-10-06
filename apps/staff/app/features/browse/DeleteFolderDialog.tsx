import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  plural,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@sneakers-web/ui";
import { useId, useState } from "react";

import { findFolder, folderLabel, type NavFolder, reassignTargets } from "@/features/browse/tree";
import { useBrowseAction } from "@/features/browse/useBrowseAction";

/** D-05 Delete folder: an empty one goes at once; one with secrets moves them first. */
export const DeleteFolderDialog = ({
  action,
  folder,
  folders,
  onClose,
}: {
  /** Where to post: the frame sidebar targets `/browse` explicitly, off the browse route. */
  action?: string;
  folder: NavFolder;
  folders: NavFolder[];
  onClose: () => void;
}) => {
  const [destination, setDestination] = useState("");
  const selectId = useId();
  const { busy, error, submit } = useBrowseAction(onClose, action);
  const count = folder.subtreeSecretCount ?? 0;
  const to = findFolder(folders, destination);
  const targets = reassignTargets(folders, folder);

  const remove = () =>
    submit({
      id: folder.id,
      intent: "delete",
      parentId: folder.parentId ?? "",
      ...(count > 0 ? { reassignTo: destination } : {}),
    });

  return (
    <Dialog onOpenChange={(o) => !o && onClose()} open>
      <DialogContent className="max-w-[32.5rem]" hideClose>
        <DialogHeader>
          <DialogTitle>Delete {folderLabel(folders, folder)}?</DialogTitle>
          <DialogDescription>
            {count > 0
              ? `It still holds ${plural(count, "secret")}. Pick where they go; nothing is deleted with the folder.`
              : "It's empty. It goes, along with any empty folders inside it."}
          </DialogDescription>
        </DialogHeader>
        {count > 0 && (
          <div className="flex flex-col gap-2">
            <Label htmlFor={selectId}>
              Move contents to
              <span aria-hidden className="text-danger">
                {" "}
                *
              </span>
            </Label>
            <Select onValueChange={setDestination} value={destination}>
              <SelectTrigger aria-required id={selectId}>
                <SelectValue placeholder="Pick a folder" />
              </SelectTrigger>
              {/* The kit's dropdown layer sits under dialogs; lift it above this one. */}
              <SelectContent className="z-[calc(var(--z-dialog)+1)]">
                {targets.map((t) => (
                  <SelectItem key={t.folder.id} value={t.folder.id}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {count > 0 && to && (
          <Alert title="Sharing changes for the moved secrets" tone="warn">
            They&apos;ll follow {to.name}&apos;s rules instead of this folder&apos;s.
          </Alert>
        )}
        {error && <Alert tone="danger">{error}</Alert>}
        <DialogFooter>
          <Button onClick={onClose} variant="secondary">
            Cancel
          </Button>
          <Button disabled={count > 0 && !to} loading={busy} onClick={remove} variant="danger">
            {count > 0 ? `Move ${count} & delete folder` : "Delete folder"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
