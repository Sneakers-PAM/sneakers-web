import { Card, cn } from "@sneakers-web/ui";
import { type ReactNode, useId } from "react";

/** A dashboard quick card: an icon tile, a title and an aside on top, then the card's body. */
export const QuickCard = ({
  aside,
  children,
  className,
  icon,
  iconClassName,
  title,
}: {
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  icon: ReactNode;
  iconClassName?: string;
  title: string;
}) => {
  const id = useId();
  return (
    <Card aria-labelledby={id} className={cn("flex flex-col gap-3.5 p-4.5", className)}>
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className={cn(
            "inline-flex size-8 shrink-0 items-center justify-center rounded-md [&_svg]:size-4",
            iconClassName,
          )}
        >
          {icon}
        </span>
        <h2 className="m-0 min-w-0 flex-1 text-body-lg font-bold" id={id}>
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </Card>
  );
};
