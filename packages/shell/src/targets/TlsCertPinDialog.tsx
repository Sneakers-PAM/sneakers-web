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
  Input,
  LongValue,
  shortDate,
} from "@sneakers-web/ui";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";

import type { TlsCertPinState } from "#shell/server/tlsCertPin.server";

import { refusalMessage } from "#shell/refusal";

/** Where the dialog posts. Each app mounts `tlsCertPinAction` at this resource route. */
export const TLS_CERT_PIN_ROUTE = "/resources/tls-cert-pin";

export interface TlsCertPinDialogProps {
  /** The target's hostname, shown while asking and typed to confirm a change. */
  hostname: string;
  onOpenChange: (open: boolean) => void;
  /** The target now pins this certificate (64 lowercase hex digits of its SHA-256). */
  onPinned: (fingerprint: string) => void;
  open: boolean;
  targetId: string;
}

const DL = "grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-body";

const Row = ({ children, term }: { children: ReactNode; term: string }) => (
  <>
    <dt className="font-bold text-muted">{term}</dt>
    <dd className="min-w-0">{children}</dd>
  </>
);

const when = (value?: null | string) => (value ? shortDate(value) : "unknown");

/**
 * Trust-on-first-use for a target's TLS certificate: scans the chain the target sends as soon as
 * it opens, shows each certificate with its SHA-256 fingerprint and the address it was read
 * from, and pins only the fingerprint the person saw, on Confirm, and only for a certificate the
 * gateway says is pinnable. When the target already pins something else, the pinned and offered
 * fingerprints sit side by side and the hostname must be typed first. Never scans or pins on
 * its own; opening it is the only way in.
 */
export const TlsCertPinDialog = ({
  hostname,
  onOpenChange,
  onPinned,
  open,
  targetId,
}: TlsCertPinDialogProps) => {
  const fetcher = useFetcher<TlsCertPinState>();
  const handled = useRef<TlsCertPinState | undefined>(undefined);
  const askedFor = useRef<null | string>(null);
  // The typed confirm belongs to one scan: a new scan, or reopening, starts it empty.
  const [typed, setTyped] = useState<{ for?: TlsCertPinState; value: string }>({ value: "" });

  const send = (fields: Record<string, string>) =>
    void fetcher.submit({ targetId, ...fields }, { action: TLS_CERT_PIN_ROUTE, method: "post" });

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
    onPinned(state.fingerprint);
  }, [fetcher.data, onOpenChange, onPinned]);

  const state = fetcher.data;
  const scan = state?.view === "scanned" ? state.scan : undefined;
  const refusal = state?.view === "problem" ? state.refusal : undefined;
  const pinnedNow = state?.view === "scanned" ? state.pinnedFingerprints : [];
  const changed =
    !!scan &&
    pinnedNow.length > 0 &&
    !scan.chain.some((c) => c.pinned) &&
    scan.chain.some((c) => c.pinnable);
  const typedNow = typed.for === state ? typed.value : "";
  const confirmed = !changed || typedNow.trim() === hostname;
  const intent = fetcher.formData?.get("intent");
  const pinningFingerprint = String(fetcher.formData?.get("fingerprint") ?? "");
  const busy = fetcher.state !== "idle";
  const scanning = busy && intent === "scan";

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pin the TLS certificate</DialogTitle>
          <DialogDescription>
            A fresh scan of {hostname} found these certificates. Pin one only once its fingerprint
            matches what you expect; a certificate that changes later is refused, never pinned
            automatically.
          </DialogDescription>
        </DialogHeader>
        {scanning && <p className="text-body text-muted">Scanning {hostname}…</p>}
        {refusal && <Alert tone="danger">{refusalMessage(refusal)}</Alert>}
        {changed && (
          <Alert tone="warn">
            {hostname} now offers a different certificate from the one pinned. If you weren&apos;t
            expecting a change, stop and ask the server&apos;s admin before you pin it.
          </Alert>
        )}
        {scan && (
          <>
            <dl className={DL}>
              <Row term="Address">
                <LongValue value={scan.address} />
              </Row>
              <Row term="TLS version">{scan.tlsVersion}</Row>
              <Row term="Checked against">{scan.serverName}</Row>
            </dl>
            {scan.systemTrusted ? (
              <Alert tone="ok">
                This chain already verifies against the system roots, so {hostname} works without a
                pin.
              </Alert>
            ) : (
              <p className="m-0 text-small text-muted">
                The system roots don&apos;t trust this chain
                {scan.systemTrustDetail ? ` (${scan.systemTrustDetail})` : ""}, so a pin is what
                lets the box connect.
              </p>
            )}
            {!scan.hostNameMatches && (
              <Alert tone="warn">
                The first certificate doesn&apos;t cover {scan.serverName}. Check you scanned the
                right host before pinning.
              </Alert>
            )}
            {changed && (
              <div className="grid gap-4 tablet:grid-cols-2">
                <div aria-label="Pinned now" className="flex min-w-0 flex-col gap-2" role="group">
                  <b className="text-small">Pinned now</b>
                  <dl className={DL}>
                    {pinnedNow.map((fp) => (
                      <Row key={fp} term="SHA-256">
                        <LongValue value={fp} />
                      </Row>
                    ))}
                  </dl>
                </div>
                <p className="m-0 self-end text-small text-muted">
                  The certificates offered now are listed below.
                </p>
              </div>
            )}
            <div className="flex flex-col gap-4">
              {scan.chain.map((cert) => (
                <div
                  aria-label={`Certificate ${cert.fingerprint}`}
                  className="flex min-w-0 flex-col gap-2 rounded-md border border-line p-3"
                  key={cert.fingerprint}
                  role="group"
                >
                  <dl className={DL}>
                    <Row term="Subject">
                      <LongValue value={cert.subject} />
                    </Row>
                    <Row term="Issuer">
                      <LongValue value={cert.issuer} />
                    </Row>
                    <Row term="Alternative names">
                      <LongValue
                        value={[...cert.dnsNames, ...cert.ipAddresses].join(", ") || "none"}
                      />
                    </Row>
                    <Row term="Valid">
                      {when(cert.notBefore)} to {when(cert.notAfter)}
                    </Row>
                    <Row term="SHA-256">
                      <LongValue value={cert.fingerprint} />
                    </Row>
                  </dl>
                  <p className="m-0 text-small text-muted">
                    {[cert.isCa ? "A CA certificate." : "", cert.selfSigned ? "Self-signed." : ""]
                      .filter(Boolean)
                      .join(" ")}
                  </p>
                  {cert.pinned && <Alert tone="ok">Already pinned</Alert>}
                  {!cert.pinned && !cert.pinnable && (
                    <p className="m-0 text-small text-muted">
                      This certificate can&apos;t be pinned on its own: pinning it alone
                      wouldn&apos;t let the box trust {hostname}.
                    </p>
                  )}
                  {!cert.pinned && cert.pinnable && (
                    <Button
                      className="self-start"
                      disabled={!confirmed}
                      loading={busy && intent === "pin" && pinningFingerprint === cert.fingerprint}
                      loadingLabel="Pinning…"
                      onClick={() => send({ fingerprint: cert.fingerprint, intent: "pin" })}
                      type="button"
                    >
                      Pin this certificate
                    </Button>
                  )}
                </div>
              ))}
            </div>
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
          </>
        )}
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} type="button" variant="secondary">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
