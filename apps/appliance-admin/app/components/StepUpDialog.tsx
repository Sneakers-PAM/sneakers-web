import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Spinner,
} from "@sneakers-web/ui";
import { useEffect, useSyncExternalStore } from "react";

import {
  cancelStepUp,
  resumeStepUp,
  stepUpPending,
  subscribeStepUp,
} from "@/lib/osadmin/stepUpController";
import { useSignInCode } from "@/lib/osadmin/useSignInCode";

/**
 * The one step-up prompt every sensitive action shares: a fresh sign-in code, the SSH
 * instruction, and a poll. On approval it resumes the action that asked for it.
 */
export const StepUpDialog = () => {
  const open = useSyncExternalStore(subscribeStepUp, stepUpPending);
  const code = useSignInCode(open);
  useEffect(() => {
    if (open && code.state === "signed-in") resumeStepUp();
  }, [open, code.state]);
  return (
    <Dialog onOpenChange={(next) => !next && cancelStepUp()} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sign in again to continue</DialogTitle>
          <DialogDescription>
            This action needs a sign-in no older than 5 minutes.
          </DialogDescription>
        </DialogHeader>
        {code.state === "starting" && <Spinner />}
        {code.begun && code.state === "pending" && (
          <div className="flex flex-col gap-3">
            <p className="font-mono text-[1.5rem] font-bold tracking-widest">{code.begun.code}</p>
            <p className="text-small text-muted">
              Run{" "}
              <code>
                ssh admin@{code.begun.sourceAddress} login {code.begun.code}
              </code>{" "}
              from a session you trust, and approve the sign-in shown as {code.begun.userAgent} from{" "}
              {code.begun.sourceAddress}.
            </p>
          </div>
        )}
        {code.state === "expired" && (
          <Button onClick={code.restart} variant="secondary">
            Get a new code
          </Button>
        )}
        <Button onClick={cancelStepUp} variant="secondary">
          Cancel
        </Button>
      </DialogContent>
    </Dialog>
  );
};
