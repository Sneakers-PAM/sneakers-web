import { cn } from "@sneakers-web/ui";
import { Check } from "lucide-react";

import { type Destination, TOP_LEVEL } from "@/features/browse/tree";

const rowClasses =
  "flex items-center gap-2 border-l-3 border-transparent px-3.5 py-2.5 text-left text-body not-first:border-t not-first:border-t-border";

/** A picked-from list of folders (D-05 Move), one radio per destination. */
export const DestinationList = ({
  destinations,
  label,
  onChange,
  topLevel = false,
  value,
}: {
  destinations: Destination[];
  label: string;
  onChange: (id: string) => void;
  /** Offer the shared top level too (site admins moving a shared folder). */
  topLevel?: boolean;
  value: string;
}) => {
  const rows = [
    ...(topLevel ? [{ id: TOP_LEVEL, label: "Shared · top level", self: false }] : []),
    ...destinations.map((d) => ({ id: d.folder.id, label: d.label, self: d.self })),
  ];
  return (
    <div
      aria-label={label}
      className="flex max-h-[min(22rem,50dvh)] flex-col overflow-y-auto rounded-lg border-[1.5px] border-border-strong"
      role="radiogroup"
    >
      {rows.map((d) => {
        const picked = d.id === value;
        return (
          <button
            aria-checked={picked}
            className={cn(
              rowClasses,
              picked ? "border-l-primary bg-primary-soft font-bold" : "hover:bg-sunken",
              d.self && "cursor-not-allowed text-muted hover:bg-transparent",
            )}
            disabled={d.self}
            key={d.id}
            onClick={() => onChange(d.id)}
            role="radio"
            type="button"
          >
            <span className="min-w-0 flex-1 truncate">
              {d.label}
              {d.self && " (this folder)"}
            </span>
            {picked && <Check aria-hidden className="size-4 text-primary" strokeWidth={3} />}
          </button>
        );
      })}
    </div>
  );
};
