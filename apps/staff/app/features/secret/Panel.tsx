import { Card, cn } from "@sneakers-web/ui";
import { type ReactNode, useId } from "react";

/** A titled card on the detail page. It's a named region, so screen readers can jump to it. */
export const Panel = ({
  aside,
  children,
  className,
  subtitle,
  title,
  tone,
}: {
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  subtitle?: ReactNode;
  title: ReactNode;
  tone?: "danger";
}) => {
  const id = useId();
  return (
    <Card
      aria-labelledby={id}
      className={cn("overflow-hidden", tone === "danger" && "border-2 border-danger", className)}
    >
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-6 py-5",
          tone === "danger" && "border-danger bg-danger-soft",
        )}
      >
        <h2 className="m-0 font-display text-h2 font-bold" id={id}>
          {title}
        </h2>
        {subtitle && <span className="text-small text-muted">{subtitle}</span>}
        {aside && <div className="ml-auto flex flex-wrap items-center gap-2">{aside}</div>}
      </div>
      {children}
    </Card>
  );
};

/** One labelled line in a panel: the label on the left, the value and its buttons on the right. */
export const Row = ({
  children,
  label,
  note,
}: {
  children: ReactNode;
  label: string;
  note?: ReactNode;
}) => {
  const id = useId();
  return (
    <div
      aria-labelledby={id}
      className="grid gap-2 border-b border-border px-6 py-4 last:border-b-0 tablet:grid-cols-[9rem_minmax(0,1fr)] tablet:items-start tablet:gap-4"
      role="group"
    >
      <div className="flex flex-col gap-0.5 tablet:pt-3">
        <span className="text-[0.875rem] font-bold" id={id}>
          {label}
        </span>
        {note}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
};
