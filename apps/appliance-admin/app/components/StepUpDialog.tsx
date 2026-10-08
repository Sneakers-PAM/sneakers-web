import {
  Alert,
  Button,
  CodeInput,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
} from "@sneakers-web/ui";
import { useState, useSyncExternalStore } from "react";

import { signIn } from "@/lib/osadmin/client";
import { refusalMessage } from "@/lib/osadmin/refusal";
import { setSession } from "@/lib/osadmin/sessionStore";
import {
  cancelStepUp,
  resumeStepUp,
  stepUpPending,
  subscribeStepUp,
} from "@/lib/osadmin/stepUpController";

/**
 * The one step-up prompt every sensitive action shares: a fresh code from the admin's
 * authenticator (StepUp). Once the box takes it, the action that asked is retried.
 */
export const StepUpDialog = () => {
  const open = useSyncExternalStore(subscribeStepUp, stepUpPending);
  return (
    <Dialog onOpenChange={(next) => !next && cancelStepUp()} open={open}>
      <DialogContent>{open && <StepUpForm />}</DialogContent>
    </Dialog>
  );
};

/** Mounted only while the dialog is open, so every request starts with an empty code. */
const StepUpForm = () => {
  const [code, setCode] = useState("");
  const [refusal, setRefusal] = useState("");
  const [busy, setBusy] = useState(false);
  const confirm = () => {
    setBusy(true);
    setRefusal("");
    signIn
      .stepUp(code)
      .then((response) => {
        setSession(response.session);
        resumeStepUp();
      })
      .catch((error: unknown) => {
        setRefusal(refusalMessage(error, { what: "code" }));
        setCode("");
      })
      .finally(() => setBusy(false));
  };
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        confirm();
      }}
    >
      <DialogHeader>
        <DialogTitle>Confirm it&apos;s you</DialogTitle>
        <DialogDescription>
          This is a sensitive change. Type a new code from your authenticator.
        </DialogDescription>
      </DialogHeader>
      {refusal && <Alert tone="danger">{refusal}</Alert>}
      <Field label="Authenticator code">
        <CodeInput label="Authenticator code" onChange={setCode} size="md" value={code} />
      </Field>
      <DialogFooter>
        <Button onClick={cancelStepUp} type="button" variant="secondary">
          Cancel
        </Button>
        <Button disabled={busy || code.length !== 6} type="submit">
          Confirm
        </Button>
      </DialogFooter>
    </form>
  );
};
