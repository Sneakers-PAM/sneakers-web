import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@sneakers-web/ui";
import { useEffect, useRef } from "react";
import { useFetcher } from "react-router";

import type { HostKeyPinState } from "#shell/server/hostKeyPin.server";

import { refusalMessage } from "#shell/refusal";

/** Where the dialog posts. Each app mounts `hostKeyPinAction` at this resource route. */
export const HOST_KEY_PIN_ROUTE = "/resources/host-key-pin";

export interface HostKeyPinDialogProps {
  /** The target's hostname, shown while asking and in the confirmation. */
  hostname: string;
  onOpenChange: (open: boolean) => void;
  /** The target now pins this key (its authorized_keys line, no comment). */
  onPinned: (publicKey: string) => void;
  open: boolean;
  targetId: string;
}

/**
 * Trust-on-first-use: scans the target's offered SSH host key as soon as it opens, shows its
 * type and SHA256 fingerprint, and pins only the fingerprint the person saw, on Confirm. Never
 * scans or pins on its own; opening it is the only way in.
 */
export const HostKeyPinDialog = ({
  hostname,
  onOpenChange,
  onPinned,
  open,
  targetId,
}: HostKeyPinDialogProps) => {
  const fetcher = useFetcher<HostKeyPinState>();
  const handled = useRef<HostKeyPinState | undefined>(undefined);
  const askedFor = useRef<null | string>(null);

  const send = (fields: Record<string, string>) =>
    void fetcher.submit({ targetId, ...fields }, { action: HOST_KEY_PIN_ROUTE, method: "post" });

  useEffect(() => {
    if (!open) {
      askedFor.current = null;
      return;
    }
    if (askedFor.current === targetId) return;
    askedFor.current = targetId;
    send({ intent: "scan" });
    // `send` is stable enough for this dialog's one job: ask again only for a new target.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, targetId]);

  // Notifies the caller once a pin lands; never sets this component's own state.
  useEffect(() => {
    const state = fetcher.data;
    if (!state || handled.current === state || state.view !== "pinned") return;
    handled.current = state;
    onOpenChange(false);
    onPinned(state.publicKey);
  }, [fetcher.data, onOpenChange, onPinned]);

  const state = fetcher.data;
  const scan = state?.view === "scanned" ? state.scan : undefined;
  const refusal = state?.view === "problem" ? state.refusal : undefined;
  const intent = fetcher.formData?.get("intent");
  const busy = fetcher.state !== "idle";
  const scanning = busy && intent === "scan";
  const pinning = busy && intent === "pin";

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pin the host key</DialogTitle>
          <DialogDescription>
            A fresh scan of {hostname} found this key. Pin it only once the fingerprint matches what
            you expect; a key that changes later is refused, never pinned automatically.
          </DialogDescription>
        </DialogHeader>
        {scanning && <p className="text-body text-muted">Scanning {hostname}…</p>}
        {refusal && <Alert tone="danger">{refusalMessage(refusal)}</Alert>}
        {scan && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-body">
            <dt className="font-bold text-muted">Key type</dt>
            <dd className="font-mono">{scan.keyType}</dd>
            <dt className="font-bold text-muted">Fingerprint</dt>
            <dd className="font-mono">{scan.fingerprint}</dd>
          </dl>
        )}
        {scan?.pinned && <Alert tone="ok">This key is already pinned.</Alert>}
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} type="button" variant="secondary">
            Cancel
          </Button>
          <Button
            disabled={!scan || scan.pinned}
            loading={pinning}
            loadingLabel="Pinning…"
            onClick={() =>
              scan &&
              send({ fingerprint: scan.fingerprint, intent: "pin", publicKey: scan.publicKey })
            }
            type="button"
          >
            Pin this key
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
