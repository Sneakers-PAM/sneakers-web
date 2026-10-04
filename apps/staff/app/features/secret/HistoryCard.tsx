import { Pill, timeAgo } from "@sneakers-web/ui";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

import type { SecretType, SecretVersion } from "@/features/secret/secret.server";

import { isSecretField } from "@/features/secret/FieldsCard";
import { Panel } from "@/features/secret/Panel";
import { RestoreVersion } from "@/features/secret/RestoreVersion";
import { SensitiveValue } from "@/features/secret/SensitiveValue";

interface Viewer {
  /** Holds the recovery role, so a prior version can be restored. */
  recovery: boolean;
  viewerId: string;
}

const Version = ({
  locked,
  type,
  v,
  viewer,
}: {
  locked?: string;
  type: null | SecretType;
  v: SecretVersion;
  viewer: Viewer;
}) => {
  const [open, setOpen] = useState(false);
  const definition = (key: string) => type?.fields.find((f) => f.key === key);
  const label = (key: string) => definition(key)?.label ?? key;
  const created = v.versionNo === 1;
  const keys = created ? v.fieldKeys : v.changedFieldKeys;
  const secretKeys = keys.filter((k) => {
    const d = definition(k);
    return d ? isSecretField(d) : false;
  });
  const shown = secretKeys.length > 0 ? secretKeys : keys;
  return (
    <li className="relative flex gap-4 pb-4 last:pb-0">
      <span
        aria-hidden
        className={
          v.active
            ? "mt-1 size-4 shrink-0 rounded-full border-[3px] border-primary bg-surface"
            : "mt-1 size-4 shrink-0 rounded-full border-[3px] border-border-strong bg-surface"
        }
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2 border-b border-border pb-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <b>Version {v.versionNo}</b>
          {v.active && (
            <Pill icon={<Check aria-hidden strokeWidth={3} />} tone="ok">
              Active
            </Pill>
          )}
          <span className="text-small text-muted">
            by {v.createdByName} · {timeAgo(v.createdAt)}
          </span>
          {!v.active && shown.length > 0 && (
            <button
              aria-expanded={open}
              aria-label={`Prior values of version ${v.versionNo}`}
              className="ml-auto inline-flex items-center gap-1 text-small text-muted hover:text-ink"
              onClick={() => setOpen((o) => !o)}
              type="button"
            >
              {open ? (
                <ChevronUp aria-hidden className="size-3.5" />
              ) : (
                <ChevronDown aria-hidden className="size-3.5" />
              )}
              {open ? "Hide prior values" : "Prior values"}
            </button>
          )}
        </div>
        <span className="text-small text-muted">
          {created
            ? "Created"
            : keys.length > 0
              ? `Changed: ${keys.map((k) => label(k).toLowerCase()).join(", ")}`
              : "No values changed"}
        </span>
        {open && (
          <div className="flex flex-col gap-2 rounded-lg bg-sunken p-3">
            {shown.map((k) => (
              <div
                className="grid items-center gap-2 tablet:grid-cols-[7rem_minmax(0,1fr)]"
                key={k}
              >
                <span className="text-small font-bold">{label(k)}</span>
                <SensitiveValue
                  compact
                  field={{ label: label(k), superSensitive: false }}
                  locked={locked}
                  target={{ fieldKey: k, versionNo: v.versionNo }}
                />
              </div>
            ))}
            {viewer.recovery && (
              <RestoreVersion versionNo={v.versionNo} viewerId={viewer.viewerId} />
            )}
          </div>
        )}
      </div>
    </li>
  );
};

/**
 * Every version, newest first: who changed what and when, for anyone who can read the secret.
 * Old values stay hidden until an audited reveal, and only the recovery role can restore one.
 */
export const HistoryCard = ({
  locked,
  recovery,
  type,
  versions,
  viewerId,
}: {
  locked?: string;
  type: null | SecretType;
  versions: SecretVersion[];
} & Viewer) => (
  <Panel
    subtitle="Everyone who can read this secret sees what changed. Values stay hidden until a recovery reveal."
    title="History"
  >
    <div className="px-6 py-5">
      <ol className="m-0 flex list-none flex-col p-0">
        {versions.map((v) => (
          <Version
            key={v.versionNo}
            locked={locked}
            type={type}
            v={v}
            viewer={{ recovery, viewerId }}
          />
        ))}
      </ol>
      {versions.length <= 1 ? (
        <p className="m-0 mt-3 text-small text-muted">No earlier versions yet.</p>
      ) : (
        !recovery && (
          <p className="m-0 mt-3 text-small text-muted">
            Earlier values and restores need the recovery role, which a site admin grants. It lets a
            person reveal an earlier version and bring it back after a change by mistake.
          </p>
        )
      )}
    </div>
  </Panel>
);
