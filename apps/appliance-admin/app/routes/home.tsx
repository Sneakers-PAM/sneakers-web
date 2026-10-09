import {
  Alert,
  Badge,
  Card,
  CardHeader,
  PageHeader,
  Pill,
  shortDate,
  Skeleton,
} from "@sneakers-web/ui";
import { useEffect, useState } from "react";

import type { GetStatusResponse, WarningKind } from "@/lib/osadmin/types";

import { NetworkReverted } from "@/components/NetworkChangeBanner";
import { ProductValues } from "@/components/ProductValues";
import { ResetCountdown } from "@/components/ResetCountdown";
import { UpgradeSteps } from "@/components/UpgradeSteps";
import { VersionChip } from "@/components/VersionChip";
import { status as statusClient } from "@/lib/osadmin/client";

/** The frame's banner shows a pending network change, and the card below an undone one. */
const NETWORK_WARNINGS = new Set<WarningKind>([
  "WARNING_KIND_NETWORK_PENDING",
  "WARNING_KIND_NETWORK_REVERTED",
]);

/** How often a factory reset in progress is re-read, so another admin's Cancel shows up. */
const RESET_POLL_MS = 5000;
/** How often an update or a product install's own steps are re-read while one is under way. */
const PROGRESS_POLL_MS = 1000;

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
  const progress = data?.upgradeProgress;
  const upgrading = !!progress?.inProgress;
  useEffect(() => {
    if (!upgrading) return;
    const timer = setInterval(reload, PROGRESS_POLL_MS);
    return () => clearInterval(timer);
  }, [upgrading]);

  return (
    <div className="flex flex-col gap-5 p-5.5">
      <PageHeader eyebrow="Appliance" title="Status" />
      {error && <Alert tone="danger">Couldn&apos;t reach the appliance.</Alert>}
      {!data && !error && <Skeleton className="h-40 w-full" />}
      {data && (
        <>
          {(data.warnings ?? [])
            .filter((warning) => !NETWORK_WARNINGS.has(warning.kind))
            .map((warning) => (
              <Alert key={warning.kind} role="status" tone="warn">
                {warning.detail}
              </Alert>
            ))}
          {data.networkChange?.lastReverted && !data.networkChange.pending && (
            <NetworkReverted
              atStart={data.networkChange.lastRevertedAtStart}
              changeId={data.networkChange.lastChangeId}
            />
          )}
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
          {progress && (progress.inProgress || progress.failed) && (
            <section aria-label="Update progress">
              <Card>
                <CardHeader
                  title={
                    progress.failed
                      ? "The last update didn't finish"
                      : `Updating to ${progress.version}`
                  }
                />
                <div className="p-5.5 text-small">
                  <UpgradeSteps progress={progress} />
                </div>
              </Card>
            </section>
          )}
          <div className="grid grid-cols-1 gap-4 tablet:grid-cols-2 desktop:grid-cols-3">
            <Card>
              <CardHeader title="Version" />
              <div className="flex flex-col gap-1 p-5.5 text-small">
                <p className="flex flex-wrap items-center gap-1.5">
                  Running <VersionChip kind="running" version={data.runningVersion} /> on{" "}
                  {data.channel}
                </p>
                {data.stagedVersion && (
                  <p className="flex flex-wrap items-center gap-1.5">
                    Staged: <VersionChip kind="staged" version={data.stagedVersion} />
                  </p>
                )}
                {!data.stagedVersion && data.previousVersion && (
                  <p>Other slot: {data.previousVersion} (revert target)</p>
                )}
                {data.revertedVersion && (
                  <p>
                    {`Reverted from ${data.revertedVersion} (by ${data.revertedBy ?? "an admin"}${data.revertedAt ? `, ${shortDate(data.revertedAt)}` : ""})`}
                  </p>
                )}
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
          <ProductValues />
          <Card>
            <CardHeader title="Health" />
            <div className="flex flex-wrap gap-2 p-5.5">
              {(data.health ?? []).map((component) => (
                <Pill key={component.name} tone={component.ok ? "ok" : "danger"}>
                  {component.name}
                </Pill>
              ))}
            </div>
          </Card>
          <Card>
            <CardHeader title="TLS" />
            <div className="flex flex-col gap-1 p-5.5 text-small">
              <p className="break-all">Fingerprint: {data.tlsFingerprint}</p>
              <p>{data.tlsSelfSigned ? "Self-signed" : "Not self-signed"}</p>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
