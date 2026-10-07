import { Alert, Badge, Card, CardHeader, PageHeader, Pill, Skeleton } from "@sneakers-web/ui";
import { useEffect, useState } from "react";

import type { GetStatusResponse } from "@/lib/osadmin/types";

import { ResetCountdown } from "@/components/ResetCountdown";
import { status as statusClient } from "@/lib/osadmin/client";

/** How often a factory reset in progress is re-read, so another admin's Cancel shows up. */
const RESET_POLL_MS = 5000;

const bytes = (n: number): string => {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = n;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(1)} ${units[unit]}`;
};

export default function Home() {
  const [data, setData] = useState<GetStatusResponse>();
  const [error, setError] = useState(false);
  const [resetCancelled, setResetCancelled] = useState(false);

  const reload = () =>
    void statusClient
      .get()
      .then(setData)
      .catch(() => setError(true));
  useEffect(reload, []);
  const resetInProgress = !!data?.factoryReset;
  useEffect(() => {
    if (!resetInProgress) return;
    const timer = setInterval(reload, RESET_POLL_MS);
    return () => clearInterval(timer);
  }, [resetInProgress]);

  return (
    <div className="flex flex-col gap-5 p-5.5">
      <PageHeader eyebrow="Appliance" title="Status" />
      {error && <Alert tone="danger">Couldn&apos;t reach the appliance.</Alert>}
      {!data && !error && <Skeleton className="h-40 w-full" />}
      {data && (
        <>
          {data.warnings.map((warning) => (
            <Alert key={warning.kind} role="status" tone="warn">
              {warning.detail}
            </Alert>
          ))}
          {resetCancelled && <Alert tone="info">The factory reset was cancelled.</Alert>}
          {data.factoryReset?.state === "FACTORY_RESET_STATE_COUNTDOWN" && (
            <ResetCountdown
              onCancelled={() => {
                setResetCancelled(true);
                reload();
              }}
              reset={data.factoryReset}
            />
          )}
          {data.factoryReset?.state === "FACTORY_RESET_STATE_PENDING" && (
            <Alert role="alert" title="A factory reset is pending" tone="danger">
              Started by {data.factoryReset.startedBy}, {data.factoryReset.approvals.length} of{" "}
              {data.factoryReset.required} approved. Approve or cancel it on the Power page.
            </Alert>
          )}
          <div className="grid grid-cols-1 gap-4 tablet:grid-cols-2 desktop:grid-cols-3">
            <Card>
              <CardHeader title="Version" />
              <div className="flex flex-col gap-1 p-5.5 text-small">
                <p>
                  Running <b>{data.runningVersion}</b> on {data.channel}
                </p>
                {data.stagedVersion && <p>Staged: {data.stagedVersion}</p>}
                {data.failedVersion && <p className="text-danger">Failed: {data.failedVersion}</p>}
              </div>
            </Card>
            <Card>
              <CardHeader title="Protection" />
              <div className="flex flex-col gap-1 p-5.5 text-small">
                <Badge tone={data.protection === "PROTECTION_FULL" ? "ok" : "warn"}>
                  {data.protection === "PROTECTION_FULL" ? "Full" : "Reduced"}
                </Badge>
                <p>At-rest custody: {data.custodyMode}</p>
                {data.protectionReason && <p>{data.protectionReason}</p>}
              </div>
            </Card>
            <Card>
              <CardHeader title="Disk" />
              <div className="flex flex-col gap-1 p-5.5 text-small">
                {data.disk && (
                  <p>
                    {bytes(data.disk.usedBytes)} of {bytes(data.disk.totalBytes)} used
                    {data.disk.growthBytesPerDay > 0 &&
                      `, growing ${bytes(data.disk.growthBytesPerDay)}/day`}
                  </p>
                )}
                <p>{data.disk?.path}</p>
              </div>
            </Card>
          </div>
          <Card>
            <CardHeader title="Health" />
            <div className="flex flex-wrap gap-2 p-5.5">
              {data.health.map((component) => (
                <Pill key={component.name} tone={component.ok ? "ok" : "danger"}>
                  {component.name}
                </Pill>
              ))}
            </div>
          </Card>
          <Card>
            <CardHeader title="TLS" />
            <div className="flex flex-col gap-1 p-5.5 text-small">
              <p>Fingerprint: {data.tlsFingerprint}</p>
              <p>{data.tlsSelfSigned ? "Self-signed" : "Not self-signed"}</p>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
