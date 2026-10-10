import { Button, Card, CardHeader, Pill, timeAgo, toast } from "@sneakers-web/ui";
import { useState } from "react";

import type { DiskCleanup, DiskLevel, GetStatusResponse } from "@/lib/osadmin/types";

import { runAction } from "@/lib/osadmin/action";
import { status as statusClient } from "@/lib/osadmin/client";

/** n in binary units, one decimal: 1.5 GB. */
export const bytes = (n: number): string => {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = n;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(1)} ${units[unit]}`;
};

const LEVELS: Record<DiskLevel, { label: string; tone: "danger" | "neutral" | "ok" | "warn" }> = {
  DISK_LEVEL_CRITICAL: { label: "Critical", tone: "danger" },
  DISK_LEVEL_OK: { label: "OK", tone: "ok" },
  DISK_LEVEL_UNSPECIFIED: { label: "Unknown", tone: "neutral" },
  DISK_LEVEL_WARNING: { label: "Warning", tone: "warn" },
};

const TRIGGERS: Record<string, string> = {
  admin: "on request",
  alert: "when a volume passed 80%",
  timer: "on the hour",
};

const freedText = (cleanup: DiskCleanup): string => `freed ${bytes(cleanup.freedBytes)}`;

/** "Last cleanup 5 min ago, on request by alice: freed 1.0 GB." */
const lastCleanupText = (cleanup: DiskCleanup): string => {
  const when = [cleanup.time && timeAgo(cleanup.time), TRIGGERS[cleanup.trigger]]
    .filter(Boolean)
    .join(", ");
  const by = cleanup.trigger === "admin" && cleanup.actor ? ` by ${cleanup.actor}` : "";
  return `Last cleanup ${when}${by}: ${freedText(cleanup)}.`;
};

/**
 * The Disk card on Status: each volume with its use and alert level (a warning from 80%,
 * critical from 90%), the product's data paths with their growth and write-ahead log, the last
 * cleanup, and Clean up now, which runs the box's cleanup at once (it asks for a fresh code).
 * A box from before the disk guard sends no volumes; the card shows its state volume then.
 */
export const DiskCard = ({
  data,
  onCleaned,
}: {
  data: GetStatusResponse;
  onCleaned: () => void;
}) => {
  const [busy, setBusy] = useState(false);
  const volumes = data.volumes ?? [];
  const cleanup = data.lastCleanup;
  const cleanUp = async () => {
    setBusy(true);
    await runAction(() => statusClient.cleanUpDisk(), {
      onSuccess: ({ cleanup: run }) => {
        toast(`Cleanup done: ${freedText(run)}.`);
        onCleaned();
      },
    });
    setBusy(false);
  };
  return (
    <section aria-label="Disk">
      <Card>
        <CardHeader
          aside={
            volumes.length > 0 && (
              <Button disabled={busy} onClick={() => void cleanUp()} size="sm" variant="secondary">
                Clean up now
              </Button>
            )
          }
          title="Disk"
        />
        <div className="flex flex-col gap-3 p-5.5 text-small">
          {volumes.length === 0 && data.disk && (
            <div className="flex flex-col gap-1">
              <p>
                {bytes(data.disk.usedBytes)} of {bytes(data.disk.totalBytes)} used
                {data.disk.growthBytesPerDay > 0 &&
                  `, growing ${bytes(data.disk.growthBytesPerDay)}/day`}
              </p>
              <p>{data.disk.path}</p>
            </div>
          )}
          {volumes.length > 0 && (
            <ul aria-label="Volumes" className="flex flex-col gap-2">
              {volumes.map((volume) => (
                <li className="flex flex-wrap items-center gap-2" key={volume.name}>
                  <span className="font-bold">{volume.label}</span>
                  {volume.sharedWith ? (
                    <span className="text-muted">
                      on the{" "}
                      {volumes.find((v) => v.name === volume.sharedWith)?.label.toLowerCase() ??
                        volume.sharedWith}{" "}
                      volume
                    </span>
                  ) : (
                    <>
                      <span>
                        {bytes(volume.usedBytes)} of {bytes(volume.totalBytes)} (
                        {Math.floor(volume.percent)}%)
                      </span>
                      <Pill tone={LEVELS[volume.level].tone}>{LEVELS[volume.level].label}</Pill>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
          {(data.dataPaths ?? []).length > 0 && (
            <ul aria-label="Product data" className="flex flex-col gap-1">
              {(data.dataPaths ?? []).map((path) => (
                <li key={path.name}>
                  {path.label}: {bytes(path.sizeBytes)}
                  {path.growthBytesPerDay > 0 && `, growing ${bytes(path.growthBytesPerDay)}/day`}
                  {path.walWarnBytes > 0 &&
                    `; write-ahead log ${bytes(path.walBytes)} of its ${bytes(path.walWarnBytes)} limit`}
                </li>
              ))}
            </ul>
          )}
          {volumes.length > 0 && (
            <p className="text-muted">
              {cleanup
                ? lastCleanupText(cleanup)
                : "The box cleans up every hour, and at once when a volume passes 80%."}
            </p>
          )}
        </div>
      </Card>
    </section>
  );
};
