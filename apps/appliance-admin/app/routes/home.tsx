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

import { DiskCard } from "@/components/DiskCard";
import { ProductValues } from "@/components/ProductValues";
import { ReducedProtectionNotice } from "@/components/ProtectionNotice";
import { ResetCountdown } from "@/components/ResetCountdown";
import { NetworkReverted } from "@/components/StatusBanners";
import { UpgradeSteps } from "@/components/UpgradeSteps";
import { VersionFields } from "@/components/VersionFields";
import { status as statusClient } from "@/lib/osadmin/client";
import { shortName } from "@/lib/parseVersion";

/** The frame's banner shows a pending network change, and the card below an undone one. */
const NETWORK_WARNINGS = new Set<WarningKind>([
  "WARNING_KIND_NETWORK_PENDING",
  "WARNING_KIND_NETWORK_REVERTED",
]);

/** How often a factory reset in progress is re-read, so another admin's Cancel shows up. */
const RESET_POLL_MS = 5000;
/** How often an update or a product install's own steps are re-read while one is under way. */
const PROGRESS_POLL_MS = 1000;

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
            .map((warning) =>
              warning.kind === "WARNING_KIND_REDUCED_PROTECTION" ? (
                <ReducedProtectionNotice
                  canHide={!!data.protectionDetail}
                  detail={warning.detail}
                  key={warning.kind}
                  onHidden={reload}
                  reason={data.protectionReason}
                />
              ) : (
                <Alert
                  key={`${warning.kind}:${warning.detail}`}
                  role={warning.critical ? "alert" : "status"}
                  tone={warning.critical ? "danger" : "warn"}
                >
                  {warning.detail}
                </Alert>
              ),
            )}
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
              <div className="flex flex-col gap-3 p-5.5 text-small">
                <VersionFields label="Running" version={data.runningVersion} />
                <p className="m-0 text-muted">{`In the active slot, on ${data.channel}`}</p>
                {data.stagedVersion && (
                  <VersionFields label="Staged" version={data.stagedVersion} />
                )}
                {!data.stagedVersion && data.previousVersion && (
                  <p>{`Other slot: ${shortName(data.previousVersion)} (revert target)`}</p>
                )}
                {data.revertedVersion && (
                  <p>
                    {`Reverted from ${shortName(data.revertedVersion)} (by ${data.revertedBy ?? "an admin"}${data.revertedAt ? `, ${shortDate(data.revertedAt)}` : ""})`}
                  </p>
                )}
                {data.failedVersion && (
                  <p className="text-danger">{`Failed: ${shortName(data.failedVersion)}`}</p>
                )}
              </div>
            </Card>
            <Card aria-label="Protection">
              <CardHeader title="Protection" />
              <div className="flex flex-col gap-1 p-5.5 text-small">
                <Badge tone={data.protection === "PROTECTION_FULL" ? "ok" : "warn"}>
                  {data.protection === "PROTECTION_FULL" ? "Full" : "Reduced"}
                </Badge>
                <p>At-rest custody: {data.custodyMode}</p>
                {data.protectionReason && <p>{data.protectionReason}</p>}
                {data.protectionDetail && <p>{data.protectionDetail}</p>}
                {data.protectionNotice?.hidden && (
                  <p className="text-muted">
                    {`The notice is hidden for everyone (by ${data.protectionNotice.hiddenBy}${data.protectionNotice.hiddenAt ? `, ${shortDate(data.protectionNotice.hiddenAt)}` : ""}). It shows again if protection changes.`}
                  </p>
                )}
              </div>
            </Card>
          </div>
          <DiskCard data={data} onCleaned={reload} />
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
