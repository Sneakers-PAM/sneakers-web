import { Badge } from "@sneakers-web/ui";

import { CopyIconButton } from "@/components/CopyIconButton";
import { parseVersion, type VersionChannel } from "@/lib/parseVersion";

const CHANNEL_LABEL: Record<VersionChannel, string> = { lab: "Lab", rc: "RC", stable: "Stable" };
const CHANNEL_TONE: Record<VersionChannel, "neutral" | "ok" | "warn"> = {
  lab: "neutral",
  rc: "warn",
  stable: "ok",
};

const pad = (value: number): string => String(value).padStart(2, "0");

/** "2026-10-10 03:13 UTC", the instant a dated lab build was made. */
const utcLabel = (iso: string): string => {
  const date = new Date(iso);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`;
};

/** The same instant in US/Eastern, for the hover. */
const easternTooltip = (iso: string): string =>
  new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    timeZone: "America/New_York",
    timeZoneName: "short",
    year: "numeric",
  }).format(new Date(iso));

/**
 * A version read out as fields instead of shown as one long string: the build's own name
 * large, on the same baseline as its label, a channel badge, and the small labelled facts a
 * lab build carries (when it was built, its commit, the release line it belongs to). The raw
 * version never shows on its own; the copy icon next to the name copies it exactly.
 */
export const VersionFields = ({
  label,
  version,
}: {
  /** "Running", "Staged", and so on; also the name the copy button and the field's own
   * data-version attribute go by. */
  label: string;
  version: string;
}) => {
  const parsed = parseVersion(version);
  const big = parsed ? (parsed.build ?? parsed.line) : version;
  const key = label.toLowerCase();
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-small font-bold text-muted">{label}</span>
        <span className="font-display text-[1.25rem] font-bold" data-version={key}>
          {big}
        </span>
        {parsed && (
          <Badge tone={CHANNEL_TONE[parsed.channel]}>{CHANNEL_LABEL[parsed.channel]}</Badge>
        )}
        <CopyIconButton label={`Copy the ${key} version`} value={version} />
      </div>
      {parsed && (parsed.builtAt ?? parsed.commit ?? parsed.build) && (
        <dl className="m-0 flex flex-wrap gap-x-4 gap-y-0.5 text-small text-muted">
          {parsed.builtAt && (
            <div className="contents">
              <dt className="sr-only">Built</dt>
              <dd className="m-0" title={easternTooltip(parsed.builtAt)}>
                {`Built ${utcLabel(parsed.builtAt)}`}
              </dd>
            </div>
          )}
          {parsed.commit && (
            <div className="contents">
              <dt className="sr-only">Commit</dt>
              <dd className="m-0">{`Commit ${parsed.commit}`}</dd>
            </div>
          )}
          {parsed.build && (
            <div className="contents">
              <dt className="sr-only">Line</dt>
              <dd className="m-0">{`Line ${parsed.line}`}</dd>
            </div>
          )}
        </dl>
      )}
    </div>
  );
};
