import {
  Alert,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  Button,
  Card,
  CardHeader,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  PageHeader,
  Pill,
  Segmented,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  shortDate,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@sneakers-web/ui";
import { useEffect, useState } from "react";

import type {
  CertEndpoint,
  GetCertificateStoreResponse,
  PendingCsr,
  StoredCertificate,
} from "@/lib/osadmin/types";

import { AddCertificate } from "@/components/certificates/AddCertificate";
import { NotAvailable } from "@/components/NotAvailable";
import { saveText } from "@/lib/download";
import { runAction } from "@/lib/osadmin/action";
import { tls } from "@/lib/osadmin/client";
import { isNotAvailable } from "@/lib/osadmin/errors";
import { useSession } from "@/lib/useSession";

const SOURCE: Record<StoredCertificate["source"], string> = {
  CERTIFICATE_SOURCE_ACME: "ACME",
  CERTIFICATE_SOURCE_CSR_SIGNED: "CSR-signed",
  CERTIFICATE_SOURCE_SELF_SIGNED: "Self-signed",
  CERTIFICATE_SOURCE_UNSPECIFIED: "Unknown",
  CERTIFICATE_SOURCE_UPLOADED: "Uploaded",
};

type Tone = "danger" | "neutral" | "ok" | "outline" | "warn";

const STATE: Record<CertEndpoint["state"], { label: string; tone: Tone }> = {
  ENDPOINT_STATE_EXPIRED: { label: "Expired", tone: "danger" },
  ENDPOINT_STATE_EXPIRING: { label: "Expiring", tone: "warn" },
  ENDPOINT_STATE_NAMES_NOT_COVERED: { label: "Names not covered", tone: "warn" },
  ENDPOINT_STATE_OK: { label: "OK", tone: "ok" },
  ENDPOINT_STATE_SELF_SIGNED: { label: "Self-signed", tone: "neutral" },
  ENDPOINT_STATE_UNAVAILABLE: { label: "Not installed", tone: "outline" },
  ENDPOINT_STATE_UNSPECIFIED: { label: "Unknown", tone: "outline" },
};

const daysLeft = (iso: string): number => Math.floor((Date.parse(iso) - Date.now()) / 86_400_000);

const short = (fingerprint = ""): string => {
  const parts = fingerprint.split(":");
  return parts.length > 4
    ? `${parts.slice(0, 2).join(":")}:...:${parts.at(-1) ?? ""}`
    : fingerprint;
};

const certLabel = (cert?: StoredCertificate): string =>
  cert ? `${cert.names[0] ?? cert.subject}, ${short(cert.fingerprint)}` : "";

export default function Certificates() {
  const { isOwner } = useSession();
  const [data, setData] = useState<GetCertificateStoreResponse>();
  const [unavailable, setUnavailable] = useState(false);
  const [adding, setAdding] = useState(false);
  const [resume, setResume] = useState<PendingCsr>();
  const [details, setDetails] = useState<StoredCertificate>();

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

  const admin = data.endpoints.find((endpoint) => endpoint.id === "admin");
  const csrs = data.csrs ?? [];
  const byId = (id?: string) => data.certificates.find((c) => c.id === id);

  return (
    <div className="flex flex-col gap-5 p-5.5">
      <PageHeader eyebrow="Configuration" title="Certificates" />
      {admin?.state === "ENDPOINT_STATE_SELF_SIGNED" && (
        <Alert title="Self-signed" tone="warn">
          This page uses the box&apos;s own self-signed certificate. Browsers warn until a CA-signed
          certificate is assigned to :8443.
        </Alert>
      )}
      {(admin?.state === "ENDPOINT_STATE_EXPIRING" ||
        admin?.state === "ENDPOINT_STATE_EXPIRED") && (
        <Alert
          role="alert"
          title="Certificate expiry"
          tone={admin.state === "ENDPOINT_STATE_EXPIRED" ? "danger" : "warn"}
        >
          {admin.stateDetail}
        </Alert>
      )}
      {!isOwner && (
        <Alert role="status" tone="info">
          Only an owner can change certificates.
        </Alert>
      )}

      <Card>
        <CardHeader
          aside={
            <Button
              disabled={!isOwner}
              onClick={() => {
                setResume(undefined);
                setAdding(true);
              }}
            >
              Add certificate
            </Button>
          }
          subtitle="Certificates the box holds, and which endpoint uses which."
          title="Certificates"
        />
        <Table aria-label="Certificates">
          <TableHead>
            <TableRow>
              <TableHeaderCell>Subject</TableHeaderCell>
              <TableHeaderCell>SANs</TableHeaderCell>
              <TableHeaderCell>Issuer</TableHeaderCell>
              <TableHeaderCell>Expires</TableHeaderCell>
              <TableHeaderCell>Fingerprint</TableHeaderCell>
              <TableHeaderCell>Used by</TableHeaderCell>
              <TableHeaderCell>
                <span className="sr-only">Actions</span>
              </TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.certificates.map((cert) => {
              const used = cert.usedBy ?? [];
              const deletable =
                used.length === 0 && cert.source !== "CERTIFICATE_SOURCE_SELF_SIGNED";
              const days = daysLeft(cert.notAfter);
              return (
                <TableRow key={cert.id}>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span className="font-mono">{cert.names[0] ?? cert.subject}</span>
                      <span className="text-small text-muted">{SOURCE[cert.source]}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-small">{cert.names.join(", ")}</TableCell>
                  <TableCell className="text-small">
                    {cert.source === "CERTIFICATE_SOURCE_SELF_SIGNED"
                      ? "(self)"
                      : (cert.chain[1] ?? cert.issuer)}
                  </TableCell>
                  <TableCell className="text-small">
                    {shortDate(cert.notAfter)}
                    <span className="block text-muted">
                      {days < 0 ? "expired" : `in ${String(days)} d`}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-small">{short(cert.fingerprint)}</TableCell>
                  <TableCell className="text-small">
                    {used.length > 0
                      ? used.map((u) => byEndpoint(data.endpoints, u)).join(", ")
                      : "--"}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button onClick={() => setDetails(cert)} size="sm" variant="secondary">
                        Details
                      </Button>
                      {deletable && isOwner && (
                        <DeleteButton
                          cert={cert}
                          onDelete={() =>
                            void runAction(() => tls.delete(cert.id), {
                              onSuccess: reload,
                              successMessage: "Certificate deleted.",
                            })
                          }
                        />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <p className="px-5.5 py-3 text-small text-muted">
          Delete is off for a certificate in use, and for the self-signed one.
        </p>
        {csrs.length > 0 && (
          <div className="border-t border-border">
            <p className="eyebrow px-5.5 pt-4">Pending requests</p>
            <Table aria-label="Pending requests">
              <TableBody>
                {csrs.map((csr) => (
                  <TableRow key={csr.id}>
                    <TableCell className="font-mono text-small">{csr.names.join(", ")}</TableCell>
                    <TableCell className="text-small">{csr.keyType}</TableCell>
                    <TableCell className="text-small">
                      {csr.created ? shortDate(csr.created) : ""}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          onClick={() => saveText(`${csr.names[0] ?? "box"}.csr`, csr.csrPem)}
                          size="sm"
                          variant="secondary"
                        >
                          Download CSR
                        </Button>
                        <Button
                          disabled={!isOwner}
                          onClick={() => {
                            setResume(csr);
                            setAdding(true);
                          }}
                          size="sm"
                        >
                          Upload signed certificate
                        </Button>
                        <Button
                          disabled={!isOwner}
                          onClick={() =>
                            void runAction(() => tls.discardCsr(csr.id), {
                              onSuccess: reload,
                              successMessage: "Request discarded.",
                            })
                          }
                          size="sm"
                          variant="secondary"
                        >
                          Discard
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <section aria-label="Endpoints">
        <Card>
          <CardHeader subtitle="Each endpoint serves one certificate." title="Endpoints" />
          <ul className="flex flex-col divide-y divide-border">
            {data.endpoints.map((endpoint) => (
              <EndpointRow
                certificates={data.certificates}
                endpoint={endpoint}
                isOwner={isOwner}
                key={endpoint.id}
                label={certLabel(byId(endpoint.certificateId))}
                onChanged={reload}
              />
            ))}
          </ul>
        </Card>
      </section>

      <section aria-label="ACME / cert-manager">
        <Card>
          <CardHeader
            aside={data.acme?.available ? undefined : <Pill tone="outline">Not available yet</Pill>}
            title="ACME / cert-manager"
          />
          <p className="px-5.5 pb-5 text-small text-muted">
            {data.acme?.reason ?? "Not available yet."} Issuers, the account and the DNS-01 provider
            appear here once it is installed.
          </p>
        </Card>
      </section>

      <section aria-label="Status">
        <Card>
          <CardHeader title="Status" />
          <dl className="grid grid-cols-[10rem_1fr] gap-x-4 gap-y-2 px-5.5 pb-5 text-small">
            <dt className="font-bold">Next renewal</dt>
            <dd>None: assigned certificates don&apos;t renew, so replace them in time.</dd>
            <dt className="font-bold">Last error</dt>
            <dd>None</dd>
            <dt className="font-bold">:8443</dt>
            <dd>{admin?.stateDetail ?? ""}</dd>
          </dl>
        </Card>
      </section>

      {adding && (
        <AddCertificate
          onChanged={reload}
          onOpenChange={(open) => {
            setAdding(open);
            if (!open) reload();
          }}
          open
          resume={resume}
        />
      )}
      <Dialog onOpenChange={(open) => !open && setDetails(undefined)} open={details !== undefined}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{details?.names[0] ?? details?.subject}</DialogTitle>
          </DialogHeader>
          {details && <CertificateDetails cert={details} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

const byEndpoint = (endpoints: CertEndpoint[], id: string): string =>
  endpoints.find((endpoint) => endpoint.id === id)?.name ?? id;

const EndpointRow = ({
  certificates,
  endpoint,
  isOwner,
  label,
  onChanged,
}: {
  certificates: StoredCertificate[];
  endpoint: CertEndpoint;
  isOwner: boolean;
  label: string;
  onChanged: () => void;
}) => {
  const [pick, setPick] = useState(endpoint.certificateId ?? "");
  const [reverting, setReverting] = useState(false);
  const state = STATE[endpoint.state];
  if (!endpoint.available) {
    return (
      <li className="flex flex-wrap items-center justify-between gap-3 px-5.5 py-4">
        <span className="font-bold">{endpoint.name}</span>
        <span className="text-small text-muted">{endpoint.unavailableReason}</span>
      </li>
    );
  }
  const assignable = certificates.filter((c) => daysLeft(c.notAfter) >= 0);
  return (
    <li className="flex flex-col gap-3 px-5.5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-bold">{endpoint.name}</span>
        <Pill tone={state.tone}>{state.label}</Pill>
      </div>
      <Segmented
        label={`${endpoint.name} source`}
        onChange={() => {}}
        options={[
          { label: "Assigned certificate", value: "assigned" },
          { disabled: true, label: "cert-manager (ACME): not available yet", value: "acme" },
        ]}
        size="sm"
        value="assigned"
      />
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-small">{label}</span>
        <Select disabled={!isOwner} onValueChange={setPick} value={pick}>
          <SelectTrigger aria-label={`Certificate for ${endpoint.name}`} className="w-72">
            <SelectValue placeholder="Choose a certificate" />
          </SelectTrigger>
          <SelectContent>
            {assignable.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {certLabel(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          disabled={!isOwner || !pick || pick === endpoint.certificateId}
          onClick={() =>
            void runAction(() => tls.assign(endpoint.id, pick), {
              onSuccess: onChanged,
              successMessage: `${endpoint.name} now serves the new certificate.`,
            })
          }
          size="sm"
        >
          Apply
        </Button>
        {endpoint.source !== "ENDPOINT_SOURCE_SELF_SIGNED" && (
          <Button
            disabled={!isOwner}
            onClick={() => setReverting(true)}
            size="sm"
            variant="secondary"
          >
            Revert to self-signed
          </Button>
        )}
      </div>
      {endpoint.stateDetail && <p className="text-small text-muted">{endpoint.stateDetail}</p>}
      <AlertDialog onOpenChange={setReverting} open={reverting}>
        <AlertDialogContent>
          <AlertDialogTitle>Revert {endpoint.name} to self-signed?</AlertDialogTitle>
          <AlertDialogDescription>
            :8443 goes back to the box&apos;s own certificate. Browsers warn again until a CA-signed
            one is assigned; the assigned certificate stays in the store.
          </AlertDialogDescription>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                void runAction(() => tls.revert(endpoint.id), {
                  onSuccess: onChanged,
                  successMessage: "Reverted to self-signed.",
                })
              }
            >
              Revert
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
};

const DeleteButton = ({ cert, onDelete }: { cert: StoredCertificate; onDelete: () => void }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} size="sm" variant="secondary">
        Delete
      </Button>
      <AlertDialog onOpenChange={setOpen} open={open}>
        <AlertDialogContent>
          <AlertDialogTitle>Delete {cert.names[0] ?? cert.subject}?</AlertDialogTitle>
          <AlertDialogDescription>
            The certificate and its sealed key are removed from the box.
          </AlertDialogDescription>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

const CertificateDetails = ({ cert }: { cert: StoredCertificate }) => (
  <dl className="grid grid-cols-[8rem_1fr] gap-x-4 gap-y-2 text-small">
    <dt className="font-bold">Source</dt>
    <dd>{SOURCE[cert.source]}</dd>
    <dt className="font-bold">Subject</dt>
    <dd className="font-mono">{cert.subject}</dd>
    <dt className="font-bold">Issuer</dt>
    <dd className="font-mono">{cert.issuer}</dd>
    <dt className="font-bold">SANs</dt>
    <dd className="font-mono">{cert.names.join(", ")}</dd>
    <dt className="font-bold">Not before</dt>
    <dd>{shortDate(cert.notBefore)}</dd>
    <dt className="font-bold">Not after</dt>
    <dd>{shortDate(cert.notAfter)}</dd>
    <dt className="font-bold">Key</dt>
    <dd>{cert.keyType}, sealed on the box</dd>
    <dt className="font-bold">SHA-256</dt>
    <dd className="font-mono break-all">{cert.fingerprint}</dd>
    <dt className="font-bold">Chain</dt>
    <dd>{cert.chain.join(" > ")}</dd>
  </dl>
);
