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
  Field,
  Textarea,
} from "@sneakers-web/ui";
import { useState } from "react";

/** A personal secret going into a shared folder: everyone with access there will see it. */
export const ShareMoveDialog = ({
  onCancel,
  onConfirm,
  open,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
}) => (
  <AlertDialog onOpenChange={(o) => !o && onCancel()} open={open}>
    <AlertDialogContent>
      <AlertDialogTitle>Share this secret?</AlertDialogTitle>
      <AlertDialogDescription>
        You&apos;re moving it from a personal folder to a shared one. Everyone with access to that
        folder will be able to see it.
      </AlertDialogDescription>
      <div className="flex flex-col-reverse gap-2.5 tablet:flex-row tablet:justify-end">
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction onClick={onConfirm} variant="primary">
          Share and save
        </AlertDialogAction>
      </div>
    </AlertDialogContent>
  </AlertDialog>
);

/**
 * A shared secret going into someone's personal folder makes it private, so a site admin
 * approves it. The other edits save now; the move happens once it's approved.
 */
export const RequestMoveDialog = ({
  onCancel,
  onSend,
  open,
}: {
  onCancel: () => void;
  onSend: (reason: string) => void;
  open: boolean;
}) => {
  const [reason, setReason] = useState("");
  return (
    <Dialog onOpenChange={(o) => !o && onCancel()} open={open}>
      <DialogContent className="max-w-[32.5rem]" hideClose>
        <DialogHeader>
          <DialogTitle>Request a move to a personal folder</DialogTitle>
          <DialogDescription>
            A personal folder makes the secret private, so a site admin approves the move. Your
            other changes save now; the move happens once it&apos;s approved.
          </DialogDescription>
        </DialogHeader>
        <Field label="Reason" required>
          <Textarea
            onChange={(event) => setReason(event.target.value)}
            placeholder="Why does this secret belong in a personal folder?"
            rows={3}
            value={reason}
          />
        </Field>
        <DialogFooter>
          <Button onClick={onCancel} variant="secondary">
            Cancel
          </Button>
          <Button disabled={!reason.trim()} onClick={() => onSend(reason.trim())}>
            Send request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
