import {
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  Label,
  PageHeader,
  Switch,
  Textarea,
} from "@sneakers-web/ui";
import { useEffect, useState } from "react";

import type { GetTlsResponse } from "@/lib/osadmin/types";

import { Advanced } from "@/components/Advanced";
import { NotAvailable } from "@/components/NotAvailable";
import { runAction } from "@/lib/osadmin/action";
import { tls } from "@/lib/osadmin/client";
import { isNotAvailable } from "@/lib/osadmin/errors";

export default function Certificates() {
  const [data, setData] = useState<GetTlsResponse>();
  const [certificatePem, setCertificatePem] = useState("");
  const [chainPem, setChainPem] = useState("");
  const [csr, setCsr] = useState("");
  const [unavailable, setUnavailable] = useState(false);

  const reload = () =>
    void tls
      .get()
      .then(setData)
      .catch((error: unknown) => {
        if (isNotAvailable(error)) setUnavailable(true);
      });
  useEffect(reload, []);

  if (unavailable) {
    return (
      <div className="p-5.5">
        <NotAvailable name="Certificates" />
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="flex flex-col gap-5 p-5.5">
      <PageHeader eyebrow="Appliance" title="Certificates" />
      <Card>
        <CardHeader subtitle={data.source} title="Product certificate" />
        <div className="flex flex-col gap-2 p-5.5 text-small">
          {data.product && (
            <>
              <p>Subject: {data.product.subject}</p>
              <p>Names: {data.product.names.join(", ")}</p>
              <p>Expires: {data.product.expires}</p>
              <p className="font-mono">{data.product.fingerprint}</p>
            </>
          )}
        </div>
        <div className="flex items-center gap-3 border-t border-border p-5.5">
          <Label className="flex items-center gap-3">
            <Switch
              checked={data.adminUsesProduct}
              onCheckedChange={(checked) =>
                void runAction(() => tls.setAdminCertificate(checked), { onSuccess: reload })
              }
            />
            :8443 also uses the product&apos;s certificate
          </Label>
        </div>
      </Card>
      <Advanced label="Advanced: trust and PKI">
        <div className="flex flex-col gap-4">
          <div>
            <p className="eyebrow mb-2">CA bundle</p>
            {data.caBundle.length === 0 && <p className="text-small text-muted">None uploaded.</p>}
            {data.caBundle.map((certificate) => (
              <p className="font-mono text-[0.8125rem]" key={certificate.fingerprint}>
                {certificate.subject} ({certificate.fingerprint})
              </p>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <Button
              onClick={() =>
                void tls.createCsr([data.product?.subject ?? ""]).then((r) => setCsr(r.csrPem))
              }
              variant="secondary"
            >
              Create a CSR
            </Button>
            {csr && <Textarea mono readOnly rows={6} value={csr} />}
          </div>
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void runAction(() => tls.uploadCertificate(certificatePem, chainPem), {
                onSuccess: () => {
                  setCertificatePem("");
                  setChainPem("");
                  reload();
                },
              });
            }}
          >
            <Field label="Certificate (PEM)">
              <Textarea
                mono
                onChange={(event) => setCertificatePem(event.target.value)}
                rows={5}
                value={certificatePem}
              />
            </Field>
            <Field label="Chain (PEM, optional)">
              <Textarea
                mono
                onChange={(event) => setChainPem(event.target.value)}
                rows={5}
                value={chainPem}
              />
            </Field>
            <Button disabled={!certificatePem} type="submit">
              Upload
            </Button>
          </form>
        </div>
      </Advanced>
      {data.source === "self-signed" && <Badge tone="warn">Self-signed</Badge>}
    </div>
  );
}
