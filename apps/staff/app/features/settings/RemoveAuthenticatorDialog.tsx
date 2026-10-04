import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@sneakers-web/ui";

/** The confirm before removing the authenticator app, which also signs the person out. */
export const RemoveAuthenticatorDialog = ({
  onConfirm,
  onOpenChange,
  open,
}: {
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) => (
  <AlertDialog onOpenChange={onOpenChange} open={open}>
    <AlertDialogContent className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <AlertDialogTitle>Remove your authenticator?</AlertDialogTitle>
        <AlertDialogDescription>
          Codes from your current app stop working, and you&apos;re signed out. You&apos;ll set up a
          new one the next time you sign in.
        </AlertDialogDescription>
      </div>
      <div className="flex justify-end gap-2.5">
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction onClick={onConfirm}>Remove authenticator</AlertDialogAction>
      </div>
    </AlertDialogContent>
  </AlertDialog>
);
