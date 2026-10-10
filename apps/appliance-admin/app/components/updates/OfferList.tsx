import { Badge } from "@sneakers-web/ui";

import type { UnitOffer } from "@/lib/osadmin/types";

import { shortLabel } from "@/components/updates/shortLabel";

/** A size in MB, one decimal under 10 MB. */
export const megabytes = (bytes: number | string): string => {
  const mb = Number(bytes) / 1_048_576;
  return `${mb < 10 ? mb.toFixed(1) : String(Math.round(mb))} MB`;
};

/** The key a picked offer goes by: a version can come full and as a patch. */
export const offerKey = (offer: UnitOffer): string => `${offer.version}/${offer.kind}`;

/**
 * What the source offers for one unit, newest first, each line labelled full or patch with its
 * size and what it needs; the line the box prefers is picked to begin with.
 */
export const OfferList = ({
  label,
  legend = "The mirror offers",
  offers,
  onPick,
  picked,
}: {
  label: string;
  legend?: string;
  offers: UnitOffer[];
  onPick: (key: string) => void;
  picked: string;
}) => (
  <fieldset aria-label={label} className="m-0 flex flex-col gap-2 border-0 p-0" role="radiogroup">
    <legend className="mb-1 text-[0.875rem] font-bold text-ink">{legend}</legend>
    {offers.map((offer) => (
      <label
        className="flex flex-wrap items-center gap-2.5 rounded-md border border-border p-3"
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
        <span className="inline-block max-w-[22ch] truncate font-bold" title={offer.version}>
          {shortLabel(offer.version)}
        </span>
        <Badge tone={offer.kind === "patch" ? "ok" : "neutral"}>{offer.kind}</Badge>
        <span className="text-muted">
          {megabytes(offer.size)}
          {offer.needs ? `, base ${offer.needs}` : ""}
        </span>
        {offer.includesBaseWeb && (
          <span className="w-full text-muted" title={offer.includesBaseWeb}>
            Includes Base Web {shortLabel(offer.includesBaseWeb)}
          </span>
        )}
        {offer.note && <span className="w-full text-muted">{offer.note}</span>}
        {offer.outsideProductRange && (
          <span className="w-full text-muted">
            Outside the installed product&apos;s range ({offer.productRange}).
          </span>
        )}
      </label>
    ))}
  </fieldset>
);
