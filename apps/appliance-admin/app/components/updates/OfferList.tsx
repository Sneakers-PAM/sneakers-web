import { Badge, cn } from "@sneakers-web/ui";

import type { UnitOffer } from "@/lib/osadmin/types";

import { shortName } from "@/lib/parseVersion";

/** A size in MB, one decimal under 10 MB. */
export const megabytes = (bytes: number | string): string => {
  const mb = Number(bytes) / 1_048_576;
  return `${mb < 10 ? mb.toFixed(1) : String(Math.round(mb))} MB`;
};

/** The key a picked offer goes by: a version can come full and as a patch. */
export const offerKey = (offer: UnitOffer): string => `${offer.version}/${offer.kind}`;

/**
 * What the source offers for one unit, newest first, by its build names, not the raw versions:
 * a patch reads as "Patch <running> -> <offered>", a full file as its own build name with a
 * "full" badge. The line the box prefers is picked to begin with, and with `markPreferred` (the
 * Base OS, where a patch and a full file compete) it carries a primary border and a "recommended"
 * badge, so it still stands out once another line is picked.
 */
export const OfferList = ({
  label,
  legend = "The mirror offers",
  markPreferred = false,
  offers,
  onPick,
  picked,
  runningVersion,
}: {
  label: string;
  legend?: string;
  /** Mark the line the box prefers (`UnitOffer.preferred`). */
  markPreferred?: boolean;
  offers: UnitOffer[];
  onPick: (key: string) => void;
  picked: string;
  /** What a patch offer is relative to: the unit's own currently running version. */
  runningVersion: string;
}) => (
  <fieldset aria-label={label} className="m-0 flex flex-col gap-2 border-0 p-0" role="radiogroup">
    <legend className="mb-1 text-[0.875rem] font-bold text-ink">{legend}</legend>
    {offers.map((offer) => {
      const marked = markPreferred && offer.preferred;
      return (
        <label
          className={cn(
            "flex flex-wrap items-center gap-2.5 rounded-md border p-3",
            marked ? "border-primary" : "border-border",
          )}
          data-preferred={marked ? "true" : undefined}
          key={offerKey(offer)}
        >
          <input
            checked={picked === offerKey(offer)}
            className="size-4 accent-primary"
            name={label}
            onChange={() => onPick(offerKey(offer))}
            type="radio"
            value={offer.version}
          />
          {offer.kind === "patch" ? (
            <span className="font-bold">
              {`Patch ${shortName(runningVersion)} → ${shortName(offer.version)}`}
            </span>
          ) : (
            <>
              <span className="font-bold">{shortName(offer.version)}</span>
              <Badge tone="neutral">full</Badge>
            </>
          )}
          {marked && <Badge tone="primary">recommended</Badge>}
          <span className="text-muted">
            {`(${megabytes(offer.size)})`}
            {offer.needs ? `, base ${offer.needs}` : ""}
          </span>
          {offer.includesBaseWeb && (
            <span className="w-full text-muted" title={offer.includesBaseWeb}>
              {`Includes Base Web ${shortName(offer.includesBaseWeb)}`}
            </span>
          )}
          {offer.note && <span className="w-full text-muted">{offer.note}</span>}
          {offer.outsideProductRange && (
            <span className="w-full text-muted">
              Outside the installed product&apos;s range ({offer.productRange}).
            </span>
          )}
        </label>
      );
    })}
  </fieldset>
);
