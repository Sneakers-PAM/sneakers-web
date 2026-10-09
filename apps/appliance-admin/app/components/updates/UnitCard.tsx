import type { ReactNode } from "react";

import { Card, CardHeader, cn } from "@sneakers-web/ui";

/** The three update units' accents, each from the kit's tokens, with ink on the tinted header. */
const ACCENTS = {
  base: { band: "border-t-primary", header: "bg-primary-soft" },
  product: { band: "border-t-sole", header: "bg-hatch" },
  web: { band: "border-t-ok", header: "bg-ok-soft" },
} as const;

export type UnitAccent = keyof typeof ACCENTS;

/** The small label in a unit card's header: what applying it does. */
const TAG =
  "rounded-sm border border-border-strong bg-surface px-2 py-0.5 text-small font-bold text-ink";

/**
 * One update unit's card on Updates (Base OS, Base Web, Product): a colour band and tinted
 * header of its own, the versions, what the source offers, the file in hand and the actions.
 */
export const UnitCard = ({
  accent,
  actions,
  children,
  subtitle,
  tag,
  testId,
  title,
}: {
  accent: UnitAccent;
  /** The Apply, Cancel staged and Revert buttons; nothing when there's none. */
  actions?: ReactNode;
  children: ReactNode;
  subtitle: string;
  tag: string;
  testId: string;
  title: string;
}) => (
  <section aria-label={title} className="min-w-0">
    <Card
      className={cn("flex h-full flex-col border-t-4", ACCENTS[accent].band)}
      data-accent={accent}
      data-testid={testId}
    >
      <CardHeader
        aside={<span className={TAG}>{tag}</span>}
        className={cn("rounded-t-xl", ACCENTS[accent].header)}
        subtitle={<span className="text-ink">{subtitle}</span>}
        title={title}
      />
      <div className="flex flex-1 flex-col gap-3 p-5.5 text-small">{children}</div>
      {actions && (
        <div className="flex flex-wrap gap-3 border-t border-border p-5.5">{actions}</div>
      )}
    </Card>
  </section>
);
