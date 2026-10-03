import { Button, cn, shortDate } from "@sneakers-web/ui";
import { Check, Clock } from "lucide-react";
import { type ReactNode } from "react";

import { certExpiry, keyLabel } from "@/features/secret/certificate";
import { Panel, Row } from "@/features/secret/Panel";
import { SensitiveValue } from "@/features/secret/SensitiveValue";

const utc = (iso?: string) => {
  const t = iso ? Date.parse(iso) : Number.NaN;
  if (Number.isNaN(t)) return "—";
  const d = new Date(t);
  return `${shortDate(t)}, ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} UTC`;
};

const Tile = ({ children, label, tone }: { children: ReactNode; label: string; tone?: string }) => (
  <div
    className={cn(
      "flex min-w-0 flex-col gap-1.5 rounded-lg bg-sunken p-3.5",
      tone === "warn" && "border-[1.5px] border-warn bg-warn-soft text-warn",
      tone === "danger" && "border-[1.5px] border-danger bg-danger-soft text-danger",
    )}
  >
    <span className="font-mono text-label tracking-[0.08em] uppercase">{label}</span>
    <b className="break-words">{children}</b>
  </div>
);

/** The parsed X.509 details, with export and replace. The private key reveals like any field. */
export const CertificateCard = ({
  fields,
  keyLocked,
  now,
  onExport,
  onReplace,
}: {
  fields: Record<string, string>;
  keyLocked?: string;
  now: number;
  onExport?: () => void;
  onReplace?: () => void;
}) => {
  const expiry = certExpiry(fields.notAfter, now);
  const hasKey = fields.hasPrivateKey === "true";
  return (
    <Panel
      aside={
        <>
          {onExport && (
            <Button onClick={onExport} size="sm" variant="secondary">
              Export…
            </Button>
          )}
          {onReplace && (
            <Button onClick={onReplace} size="sm" variant="secondary">
              Replace certificate…
            </Button>
          )}
        </>
      }
      subtitle="Exporting a private key is recorded in the audit log."
      title="Certificate"
    >
      <div className="grid grid-cols-2 gap-3 border-b border-border px-6 py-5 desktop:grid-cols-4">
        <Tile label="Subject">{fields.subject || "—"}</Tile>
        <Tile label="Issuer">{fields.issuer?.replace(/^CN=/, "") || "—"}</Tile>
        <Tile label="Validity" tone={expiry.tone}>
          <span className="inline-flex items-center gap-1.5">
            <Clock aria-hidden className="size-4" />
            {expiry.label}
          </span>
        </Tile>
        <Tile label="Key">{keyLabel(fields.keyAlgorithm, fields.keyBits)}</Tile>
      </div>
      <Row label="SANs">{fields.sans?.split(",").join(", ") || "—"}</Row>
      <Row label="Not before">{utc(fields.notBefore)}</Row>
      <Row label="Not after">
        <b>{utc(fields.notAfter)}</b>
      </Row>
      <Row label="Serial">
        <span className="font-mono">{fields.serialNumber || "—"}</span>
      </Row>
      <Row label="SHA-256">
        <span className="font-mono text-small break-all">{fields.fingerprintSha256 || "—"}</span>
      </Row>
      <Row label="CA">{fields.isCA === "true" ? "Yes" : "No"}</Row>
      <Row label="Private key">
        {hasKey ? (
          <div className="flex flex-col gap-2">
            <span className="inline-flex items-center gap-1.5">
              <Check aria-hidden className="size-4" />
              Present (stored encrypted)
            </span>
            <SensitiveValue
              compact
              field={{ label: "Private key", superSensitive: true }}
              locked={keyLocked}
              target={{ fieldKey: "privateKey" }}
            />
          </div>
        ) : (
          <span className="text-muted">Not on file</span>
        )}
      </Row>
    </Panel>
  );
};
