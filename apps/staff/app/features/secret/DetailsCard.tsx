import {
  HeartbeatPill,
  type HeartbeatStatus,
  RotationPill,
  type RotationStatus,
  shortDate,
  timeAgo,
} from "@sneakers-web/ui";
import { type ReactNode } from "react";

import type { SecretPage } from "@/features/secret/secret.server";

const DAY = 86_400_000;

const heartbeatStatus = (result: null | string, hasTarget: boolean): HeartbeatStatus => {
  if (!hasTarget) return "none";
  if (result === "ok") return "verified";
  if (result === "failed") return "drift";
  if (result === "unreachable") return "unreachable";
  return "unknown";
};

const rotationStatus = (result: null | string): RotationStatus => {
  if (result === "ok") return "rotated";
  if (["degraded", "failed", "rotating"].includes(result ?? "")) return result as RotationStatus;
  return "unknown";
};

const Line = ({ children, label }: { children: ReactNode; label: string }) => (
  <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-3.5 last:border-b-0">
    <span className="text-muted">{label}</span>
    <div className="flex flex-col items-end gap-1 text-right">{children}</div>
  </div>
);

/** Type, target, heartbeat, rotation and expiry. */
export const DetailsRows = ({ page }: { page: SecretPage }) => {
  const { secret, target, type } = page;
  const expires = secret.expiresAt ? Date.parse(secret.expiresAt) : Number.NaN;
  const days = Math.floor((expires - page.now) / DAY);
  return (
    <>
      <Line label="Type">
        <b>{type?.name ?? secret.typeId}</b>
      </Line>
      <Line label="Target">
        {target ? (
          <>
            <b>{target.name}</b>
            <span className="font-mono text-small text-muted">{target.hostname}</span>
          </>
        ) : (
          <span className="text-muted">None</span>
        )}
      </Line>
      {type?.heartbeat && (
        <Line label="Heartbeat">
          <HeartbeatPill status={heartbeatStatus(secret.lastHeartbeatResult, !!target)} />
          {secret.verifiedAt && (
            <span className="text-small text-muted">Last checked {timeAgo(secret.verifiedAt)}</span>
          )}
        </Line>
      )}
      {type?.rotation && (
        <Line label="Rotation">
          <RotationPill status={rotationStatus(secret.lastRotationResult)} />
          {secret.nextRotationAt && (
            <span className="text-small text-muted">
              Next rotation in{" "}
              {Math.max(0, Math.ceil((Date.parse(secret.nextRotationAt) - page.now) / DAY))} days
            </span>
          )}
        </Line>
      )}
      {secret.rotatedAt && (
        <Line label="Last rotated">
          <b>{timeAgo(secret.rotatedAt)}</b>
        </Line>
      )}
      <Line label="Expires">
        {Number.isNaN(expires) ? (
          <b>Never</b>
        ) : (
          <b className={days <= 30 ? "text-warn" : undefined}>
            {shortDate(expires)}
            {days >= 0 && days <= 30 ? ` · ${days} days` : ""}
          </b>
        )}
      </Line>
    </>
  );
};
