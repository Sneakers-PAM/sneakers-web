import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from "@sneakers-web/ui";
import { useId, useState } from "react";

/** D-01: rotating replaces the credential on the target straight away. */
export const RotateDialog = ({
  field,
  name,
  onConfirm,
  onOpenChange,
  open,
  target,
}: {
  field: string;
  name: string;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  target?: string;
}) => (
  <AlertDialog onOpenChange={onOpenChange} open={open}>
    <AlertDialogContent>
      <AlertDialogTitle>Rotate credential for {name}?</AlertDialogTitle>
      <AlertDialogDescription>
        A new {field.toLowerCase()} is set{target ? ` on ${target}` : ""} now. Anything still using
        the old one stops working, including open sessions that sign in again.
      </AlertDialogDescription>
      <div className="flex flex-col-reverse gap-2.5 tablet:flex-row tablet:justify-end">
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction onClick={onConfirm} variant="primary">
          Rotate
        </AlertDialogAction>
      </div>
    </AlertDialogContent>
  </AlertDialog>
);

/** D-04: a permanent delete. In production the name has to be typed to confirm it. */
export const DeleteDialog = ({
  busy,
  name,
  onConfirm,
  onOpenChange,
  open,
  typeToConfirm,
}: {
  busy: boolean;
  name: string;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  typeToConfirm: boolean;
}) => {
  const [typed, setTyped] = useState("");
  const id = useId();
  return (
    <Dialog
      onOpenChange={(o) => {
        if (!o) setTyped("");
        onOpenChange(o);
      }}
      open={open}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {name} permanently?</DialogTitle>
          <DialogDescription>
            This removes the secret, every version and its history. The audit log keeps a record
            that it existed. This can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>
        {typeToConfirm && (
          <div className="flex flex-col gap-2">
            <label className="text-[0.875rem] font-bold" htmlFor={id}>
              Type <code className="rounded-xs bg-sunken px-1.5 py-0.5 font-mono">{name}</code> to
              confirm
            </label>
            <Input
              autoComplete="off"
              id={id}
              onChange={(event) => setTyped(event.target.value)}
              value={typed}
            />
          </div>
        )}
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="secondary">
            Cancel
          </Button>
          <Button
            disabled={typeToConfirm && typed !== name}
            loading={busy}
            loadingLabel="Deleting…"
            onClick={onConfirm}
            variant="danger"
          >
            Delete permanently
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
