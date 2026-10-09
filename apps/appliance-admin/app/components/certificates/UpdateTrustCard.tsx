import {
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  Pill,
  shortDate,
  Textarea,
} from "@sneakers-web/ui";
import { useState } from "react";

import type { UpdateTrust } from "@/lib/osadmin/types";

import { runAction } from "@/lib/osadmin/action";
import { tls } from "@/lib/osadmin/client";

/**
 * The update mirror's own trust: private CAs an https:// mirror may chain to, for the mirror's
 * fetches only, and an optional pin on its server certificate. There is no way to turn
 * verification off.
 */
export const UpdateTrustCard = ({
  isOwner,
  onChanged,
  trust,
}: {
  isOwner: boolean;
  onChanged: () => void;
  trust?: UpdateTrust;
}) => {
  const [caPem, setCaPem] = useState("");
  const [pin, setPin] = useState(trust?.pinSha256 ?? "");

  const save = () =>
    void runAction(() => tls.setUpdateTrust(caPem.trim(), pin.trim()), {
      onSuccess: () => {
        setCaPem("");
        onChanged();
      },
      successMessage: "Update trust saved.",
    });
  const clear = () =>
    void runAction(() => tls.clearUpdateTrust(), {
      onSuccess: () => {
        setPin("");
        onChanged();
      },
      successMessage: "Update trust removed.",
    });

  return (
    <section aria-label="Update trust" id="update-trust">
      <Card>
        <CardHeader
          aside={trust ? undefined : <Pill tone="outline">System roots only</Pill>}
          subtitle="For an https:// update mirror with an internal CA. Trusted for the mirror's fetches only."
          title="Update trust"
        />
        <div className="flex flex-col gap-4 px-5.5 pb-5 text-small">
          {trust ? (
            <ul aria-label="Trusted CAs" className="flex flex-col gap-2">
              {trust.cas.map((ca) => (
                <li className="rounded-md border border-border p-3" key={ca.sha256}>
                  <p className="font-bold">{ca.subject}</p>
                  <p className="text-muted">
                    Issued by {ca.issuer}
                    {ca.notAfter ? `, expires ${shortDate(ca.notAfter)}` : ""}
                  </p>
                  <p className="break-all font-mono">{ca.sha256}</p>
                </li>
              ))}
              <li>
                Pin:{" "}
                {trust.pinSha256 ? (
                  <span className="break-all font-mono">{trust.pinSha256}</span>
                ) : (
                  "none"
                )}
              </li>
            </ul>
          ) : (
            <p>
              The mirror is checked against the system roots. A mirror with an internal CA is
              refused until its CA is added here.
            </p>
          )}
          {isOwner && (
            <>
              <Field
                hint="One or more PEM CA certificates. Saving replaces the trust set before."
                label="CA certificate (PEM)"
              >
                <Textarea
                  onChange={(event) => setCaPem(event.target.value)}
                  placeholder="-----BEGIN CERTIFICATE-----"
                  rows={5}
                  value={caPem}
                />
              </Field>
              <input
                accept=".pem,.crt,.cer"
                aria-label="CA certificate file"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void file.text().then(setCaPem);
                }}
                type="file"
              />
              <Field
                hint="Optional: the mirror's server certificate SHA-256, with or without colons. Checked after the chain, never instead of it."
                label="Server certificate pin"
              >
                <Input onChange={(event) => setPin(event.target.value)} value={pin} />
              </Field>
              <p className="text-muted">There&apos;s no option to skip verification.</p>
              <div className="flex flex-wrap gap-3">
                <Button disabled={!caPem.trim() && !pin.trim()} onClick={save}>
                  Save update trust
                </Button>
                {trust && (
                  <Button onClick={clear} variant="secondary">
                    Remove update trust
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </Card>
    </section>
  );
};
