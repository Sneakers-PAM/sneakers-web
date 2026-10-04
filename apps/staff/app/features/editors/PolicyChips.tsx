import { cn } from "@sneakers-web/ui";
import { Check, X } from "lucide-react";

import type { PolicyCheck } from "@/features/editors/policy";

/** What a strict policy asks of the typed password, met or not, as the frame's chips. */
export const PolicyChips = ({ checks }: { checks: PolicyCheck[] }) => {
  const missing = checks.some((c) => !c.met);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={cn("text-small font-bold", missing ? "text-danger" : "text-ok")}>
        Must contain:
      </span>
      <ul aria-label="Must contain" className="m-0 flex list-none flex-wrap gap-1.5 p-0">
        {checks.map((c) => (
          <li
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-small font-bold",
              c.met ? "bg-ok-soft text-ok" : "bg-danger-soft text-danger",
            )}
            data-met={c.met}
            key={c.label}
          >
            {c.met ? (
              <Check aria-label="met" className="size-3" strokeWidth={3} />
            ) : (
              <X aria-label="missing" className="size-3" strokeWidth={3} />
            )}
            {c.label}
          </li>
        ))}
      </ul>
    </div>
  );
};
