import type { ReactNode } from "react";

import { LongValue } from "#ui/components/LongValue";

export interface FingerprintCheckProps {
  offered: FingerprintSubject;
  /**
   * The fingerprints pinned now, when the offered one isn't among them: shown side by side with
   * the offered one so a change is plain. Empty or left out when nothing is pinned yet.
   */
  pinned?: string[];
}

/** What a scan read from a host, for a person to check before they pin it. */
export type FingerprintSubject =
  | {
      /** The host:port the scan was read from. */
      address: string;
      /** SHA256:<base64>, as ssh-keygen -l prints it. */
      fingerprint: string;
      keyType: string;
      kind: "ssh-host-key";
    }
  | {
      address: string;
      /** The certificate's SHA-256 fingerprint. */
      fingerprint: string;
      issuer: string;
      kind: "tls-certificate";
      /** Shown as given, so the caller formats the dates. */
      notAfter: string;
      notBefore: string;
      /** The subject alternative names. */
      sans: string[];
      subject: string;
    };

const DL = "grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-body";

const Row = ({ children, term }: { children: ReactNode; term: string }) => (
  <>
    <dt className="font-bold text-muted">{term}</dt>
    <dd>{children}</dd>
  </>
);

const OfferedRows = ({ offered }: { offered: FingerprintSubject }) =>
  offered.kind === "ssh-host-key" ? (
    <>
      <dt className="font-bold text-muted">Key type</dt>
      <dd className="font-mono">{offered.keyType}</dd>
      <Row term="Fingerprint">
        <LongValue value={offered.fingerprint} />
      </Row>
      <Row term="Address">
        <LongValue value={offered.address} />
      </Row>
    </>
  ) : (
    <>
      <Row term="Subject">
        <LongValue value={offered.subject} />
      </Row>
      <Row term="Alternative names">
        <LongValue value={offered.sans.join(", ")} />
      </Row>
      <Row term="Issuer">
        <LongValue value={offered.issuer} />
      </Row>
      <Row term="Valid">
        {offered.notBefore} to {offered.notAfter}
      </Row>
      <Row term="SHA-256">
        <LongValue value={offered.fingerprint} />
      </Row>
      <Row term="Address">
        <LongValue value={offered.address} />
      </Row>
    </>
  );

const Column = ({ children, label }: { children: ReactNode; label: string }) => (
  <div aria-label={label} className="flex min-w-0 flex-col gap-2" role="group">
    <b className="text-small">{label}</b>
    {children}
  </div>
);

/**
 * What a trust-on-first-use scan found, for a person to compare with a fingerprint they got
 * another way before pinning it: an SSH host key, or a TLS certificate. When the host now offers
 * something other than what's pinned, the pinned fingerprints and the offered one sit side by
 * side.
 */
export const FingerprintCheck = ({ offered, pinned = [] }: FingerprintCheckProps) => (
  <div className="flex flex-col gap-3">
    {pinned.length > 0 ? (
      <div className="grid gap-4 tablet:grid-cols-2">
        <Column label="Pinned now">
          <dl className={DL}>
            {pinned.map((fp) => (
              <Row key={fp} term="Fingerprint">
                <LongValue value={fp} />
              </Row>
            ))}
          </dl>
        </Column>
        <Column label="Offered now">
          <dl className={DL}>
            <OfferedRows offered={offered} />
          </dl>
        </Column>
      </div>
    ) : (
      <dl className={DL}>
        <OfferedRows offered={offered} />
      </dl>
    )}
    <p className="m-0 text-small text-muted">
      Check the fingerprint against one you got another way, from the server&apos;s console or its
      admin, before you pin it.
    </p>
  </div>
);
