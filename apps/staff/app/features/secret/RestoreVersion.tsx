import {
  needsStepUp,
  type Refusal,
  refusalMessage,
  StepUpDialog,
  useStepUp,
} from "@sneakers-web/shell";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  Button,
} from "@sneakers-web/ui";
import { RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { useSecretFetcher } from "@/features/secret/useSecretFetcher";

/** What the recovery role is for, said wherever the history can't offer it. */
export const RECOVERY_ROLE_HELP =
  "It lets a person reveal earlier values and bring one back, and a site admin grants it.";

/** A refused restore in plain words, naming who holds the check-out when that's the reason. */
export const restoreRefusalMessage = (refusal: Refusal, viewerId: string): string => {
  if (refusal.reason === "RECOVERY_ROLE_REQUIRED")
    return `Restoring needs the recovery role. ${RECOVERY_ROLE_HELP}`;
  if (refusal.reason === "CHECKOUT_LEASE_HELD") {
    if (refusal.metadata.holder_user_id === viewerId)
      return "You have this secret checked out. Check it in, then restore.";
    const name = refusal.metadata.holder_name;
    if (name) return `${name} has this secret checked out. Restore it after they check it in.`;
  }
  return refusalMessage(refusal);
};

/**
 * "Restore this version": confirmed first, then a step-up when the vault asks for one. The
 * restore adds a new active version with this version's values, and the page reloads.
 */
export const RestoreVersion = ({
  versionNo,
  viewerId,
}: {
  versionNo: number;
  viewerId: string;
}) => {
  const fetcher = useSecretFetcher({ quiet: true });
  const stepUp = useStepUp();
  const [confirming, setConfirming] = useState(false);
  const handled = useRef<unknown>(null);
  const result = fetcher.data?.intent === "restore-version" ? fetcher.data : undefined;

  const send = useCallback(
    () =>
      void fetcher.submit(
        { intent: "restore-version", versionNo: String(versionNo) },
        { method: "post" },
      ),
    [fetcher, versionNo],
  );

  useEffect(() => {
    if (!result || handled.current === result) return;
    handled.current = result;
    if (!result.ok && needsStepUp(result.refusal)) stepUp.ask(send);
  }, [result, send, stepUp]);

  const refusal = result && !result.ok && !needsStepUp(result.refusal) ? result.refusal : null;

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-3">
      <div className="flex flex-col items-start gap-2 tablet:flex-row tablet:items-center tablet:gap-3">
        <span className="min-w-0 flex-1 text-small text-muted">
          Restoring adds a new version with these values. The current ones stay in the history.
        </span>
        <Button
          aria-label={`Restore version ${versionNo}`}
          loading={fetcher.state !== "idle"}
          loadingLabel="Restoring…"
          onClick={() => setConfirming(true)}
          size="sm"
          variant="secondary"
        >
          <RotateCcw aria-hidden />
          Restore this version
        </Button>
      </div>
      {refusal && (
        <span className="text-small font-bold text-danger" role="alert">
          {restoreRefusalMessage(refusal, viewerId)}
        </span>
      )}
      <AlertDialog onOpenChange={setConfirming} open={confirming}>
        <AlertDialogContent>
          <AlertDialogTitle>Restore version {versionNo}?</AlertDialogTitle>
          <AlertDialogDescription>
            Version {versionNo}&apos;s values become the current ones, as a new version. Anything
            using the current values needs the restored ones, and a target is checked against them
            next. This is logged.
          </AlertDialogDescription>
          <div className="flex flex-col-reverse gap-2.5 tablet:flex-row tablet:justify-end">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={send} variant="primary">
              Restore version
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
      <StepUpDialog
        {...stepUp.dialog}
        description={`Restoring version ${versionNo} needs a fresh second factor.`}
      />
    </div>
  );
};
