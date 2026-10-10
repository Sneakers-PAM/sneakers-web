import {
  Alert,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  Button,
} from "@sneakers-web/ui";
import { useState } from "react";

import { runAction } from "@/lib/osadmin/action";
import { status } from "@/lib/osadmin/client";

/**
 * The reduced-protection warning on Status. Any admin may hide it for everyone with a plain
 * confirm; the box keeps that for the level and reason, and shows it again when either changes.
 * `canHide` is false on a box from before the notice could be hidden.
 */
export const ReducedProtectionNotice = ({
  canHide,
  detail,
  onHidden,
  reason,
}: {
  canHide: boolean;
  detail: string;
  onHidden: () => void;
  reason: string;
}) => {
  const [confirming, setConfirming] = useState(false);
  return (
    <section aria-label="Reduced protection">
      <Alert
        action={
          canHide && (
            <Button onClick={() => setConfirming(true)} size="sm" variant="secondary">
              Hide this notice
            </Button>
          )
        }
        role="status"
        tone="warn"
      >
        {detail}
      </Alert>
      <AlertDialog onOpenChange={setConfirming} open={confirming}>
        <AlertDialogContent>
          <AlertDialogTitle>Hide this notice?</AlertDialogTitle>
          <AlertDialogDescription>
            It won&apos;t be shown again. Protection stays reduced until it&apos;s raised; the
            Status page still lists it.
          </AlertDialogDescription>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                void runAction(() => status.hideProtectionNotice(reason), { onSuccess: onHidden })
              }
            >
              Hide
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
};
