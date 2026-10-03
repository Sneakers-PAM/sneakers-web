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
  Textarea,
  toast,
} from "@sneakers-web/ui";
import { useEffect, useRef } from "react";
import { useFetcher } from "react-router";

import type { ActResult } from "@/features/requests/act.server";
import type { NewRequest } from "@/features/requests/model";

import { requestRefusalMessage } from "@/features/requests/messages";

/**
 * The "request access" form, opened by `/requests?new=<secretId>` (the secret page links
 * here). The reason goes to the approvers with the request.
 */
export const RequestAccessDialog = ({
  asking,
  onClose,
}: {
  asking: NewRequest | null;
  onClose: () => void;
}) => {
  const send = useFetcher<ActResult>({ key: "request-access" });
  const handled = useRef<unknown>(null);

  useEffect(() => {
    const d = send.data;
    if (send.state !== "idle" || !d?.ok || handled.current === d) return;
    handled.current = d;
    toast("Request sent. An approver will look at it.");
    onClose();
  }, [send.state, send.data, onClose]);

  const refusal = send.data && !send.data.ok ? send.data.refusal : null;
  const title = asking?.name ? `Request access to ${asking.name}` : "Request access";

  return (
    <Dialog onOpenChange={(o) => !o && onClose()} open={!!asking}>
      <DialogContent>
        <DialogHeader>
          <span className="eyebrow">Access request</span>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            An approver for the secret decides. If they approve, you hold it for the hours they
            grant.
          </DialogDescription>
        </DialogHeader>
        {asking && !asking.name ? (
          <>
            <Alert tone="warn">{"That secret doesn't exist, or you can't see it."}</Alert>
            <DialogFooter>
              <Button onClick={onClose} variant="secondary">
                Close
              </Button>
            </DialogFooter>
          </>
        ) : asking?.alreadyPending ? (
          <>
            <Alert tone="info">
              You already asked for access to this secret. Follow it under Your open requests.
            </Alert>
            <DialogFooter>
              <Button onClick={onClose} variant="secondary">
                Close
              </Button>
            </DialogFooter>
          </>
        ) : (
          <send.Form className="flex flex-col gap-5" method="post">
            <input name="intent" type="hidden" value="create" />
            <input name="secretId" type="hidden" value={asking?.secretId ?? ""} />
            <Field hint="Approvers read this before they decide." label="Why do you need it?">
              <Textarea name="reason" rows={3} />
            </Field>
            {refusal && (
              <Alert role="alert" title="The request didn't go through" tone="danger">
                {requestRefusalMessage(refusal)}
              </Alert>
            )}
            <DialogFooter>
              <Button onClick={onClose} variant="secondary">
                Cancel
              </Button>
              <Button loading={send.state !== "idle"} loadingLabel="Sending…" type="submit">
                Send request
              </Button>
            </DialogFooter>
          </send.Form>
        )}
      </DialogContent>
    </Dialog>
  );
};
