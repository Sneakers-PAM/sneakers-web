import type { ReactNode } from "react";

import { Alert, Card, CardHeader, Pill, shortDate } from "@sneakers-web/ui";
import { Link } from "react-router";

import type { MirrorStatus } from "@/lib/osadmin/types";

const daysLeft = (iso: string): number => Math.floor((Date.parse(iso) - Date.now()) / 86_400_000);

const pinState = (status: MirrorStatus): string => {
  if (!status.pinned) return "Not pinned";
  if (!status.serverSha256) return "Pinned, not checked yet";
  return status.pinMatched ? "Matched" : "Doesn't match";
};

/**
 * The update mirror: the source and its controls (children: Check now, the source choice), and
 * from GetUpgrades its transport and its last fetch: for HTTPS the server certificate the box was
 * presented with, refused or not, and whether the pin matched. With no source and no children
 * it isn't shown.
 */
export const MirrorStatusCard = ({
  children,
  status,
}: {
  children?: ReactNode;
  status?: MirrorStatus;
}) => {
  if (!status && !children) return null;
  if (!status)
    return (
      <section aria-label="Update mirror">
        <Card>
          <CardHeader title="Update mirror" />
          <div className="flex flex-col gap-4 px-5.5 pb-5 text-small">{children}</div>
        </Card>
      </section>
    );
  const https = status.scheme === "https";
  return (
    <section aria-label="Update mirror">
      <Card>
        <CardHeader
          aside={<Pill tone={https ? "ok" : "neutral"}>{https ? "HTTPS" : "Plain HTTP"}</Pill>}
          title="Update mirror"
        />
        <div className="flex flex-col gap-4 px-5.5 pb-5 text-small">
          {children}
          {status.url && <p className="break-all">URL: {status.url}</p>}
          <p>
            {https
              ? `${status.note}.`
              : "Plain HTTP: integrity from the signature only. Every file is still checked by its signature before anything is unpacked."}
          </p>
          {https && status.serverSha256 && (
            <dl className="grid grid-cols-[10rem_1fr] gap-x-4 gap-y-2">
              <dt className="font-bold">Server certificate</dt>
              <dd>{status.serverSubject}</dd>
              <dt className="font-bold">Issuer</dt>
              <dd>{status.serverIssuer}</dd>
              <dt className="font-bold">Expires</dt>
              <dd>
                {status.serverNotAfter
                  ? `${shortDate(status.serverNotAfter)} (${String(daysLeft(status.serverNotAfter))} days)`
                  : ""}
              </dd>
              <dt className="font-bold">SHA-256</dt>
              <dd className="break-all font-mono">{status.serverSha256}</dd>
              <dt className="font-bold">Pin</dt>
              <dd>{pinState(status)}</dd>
            </dl>
          )}
          {!status.checked && (
            <p className="text-muted">Not checked yet: a fetch or Check now tries it.</p>
          )}
          {status.checked && status.ok && (
            <p>Last fetch OK{status.checkedAt ? `, ${shortDate(status.checkedAt)}` : ""}.</p>
          )}
          {status.checked && !status.ok && (
            <Alert role="alert" title="The last fetch was refused" tone="danger">
              <p>
                <code>{status.code}</code>: {status.error}
              </p>
            </Alert>
          )}
          {https && (
            <p>
              <Link className="font-bold text-primary underline" to="/certificates#update-trust">
                {status.customCa || status.pinned
                  ? "Change the update trust on Certificates"
                  : "Add a private CA or a pin on Certificates"}
              </Link>
            </p>
          )}
        </div>
      </Card>
    </section>
  );
};
