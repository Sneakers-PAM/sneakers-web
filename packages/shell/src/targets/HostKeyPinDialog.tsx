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
  FingerprintCheck,
  Input,
} from "@sneakers-web/ui";
import { useEffect, useRef, useState } from "react";
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
 * type, SHA256 fingerprint and the address it was read from, and pins only the fingerprint the
 * person saw, on Confirm. A key that differs from what's pinned is shown beside the pinned ones
 * and needs the hostname typed first (#318). Never scans or pins on its own; opening it is the
 * only way in.
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
  // The typed confirm belongs to one scan: a new scan, or reopening, starts it empty.
  const [typed, setTyped] = useState<{ for?: HostKeyPinState; value: string }>({ value: "" });

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
  const pinnedNow = state?.view === "scanned" ? state.pinnedFingerprints : [];
  const changed = !!scan && !scan.pinned && pinnedNow.length > 0;
  const typedNow = typed.for === state ? typed.value : "";
  const confirmed = !changed || typedNow.trim() === hostname;
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
        {changed && (
          <Alert tone="warn">
            {hostname} now offers a different key from the one pinned. If you weren&apos;t expecting
            a change, stop and ask the server&apos;s admin before you pin it.
          </Alert>
        )}
        {scan && (
          <FingerprintCheck
            offered={{
              address: scan.address,
              fingerprint: scan.fingerprint,
              keyType: scan.keyType,
              kind: "ssh-host-key",
            }}
            pinned={changed ? pinnedNow : []}
          />
        )}
        {changed && (
          <Field label={`Type ${hostname} to confirm`}>
            <Input
              autoCapitalize="none"
              mono
              onChange={(event) => setTyped({ for: state, value: event.target.value })}
              spellCheck={false}
              value={typedNow}
            />
          </Field>
        )}
        {scan?.pinned && <Alert tone="ok">This key is already pinned.</Alert>}
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} type="button" variant="secondary">
            Cancel
          </Button>
          <Button
            disabled={!scan || scan.pinned || !confirmed}
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
