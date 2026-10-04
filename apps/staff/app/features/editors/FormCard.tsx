import { Card, cn } from "@sneakers-web/ui";
import { type ReactNode, useId } from "react";

/** A titled card on the editor. It's a named region, so screen readers can jump to it. */
export const FormCard = ({
  children,
  className,
  subtitle,
  title,
}: {
  children: ReactNode;
  className?: string;
  subtitle?: ReactNode;
  title: string;
}) => {
  const id = useId();
  return (
    <Card aria-labelledby={id} className={cn("flex flex-col gap-5 p-5.5", className)}>
      <div className="flex flex-col gap-1">
        <h2 className="m-0 font-display text-h2 font-bold" id={id}>
          {title}
        </h2>
        {subtitle && <span className="text-small text-muted">{subtitle}</span>}
      </div>
      {children}
    </Card>
  );
};
