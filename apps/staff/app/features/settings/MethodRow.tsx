import { type ReactNode, useId } from "react";

/** One sign-in method on the Security page: its name and state, with its action on the right. */
export const MethodRow = ({
  action,
  children,
  title,
}: {
  action?: ReactNode;
  children?: ReactNode;
  title: string;
}) => {
  const id = useId();
  return (
    <div
      aria-labelledby={id}
      className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-border py-4 last:border-b-0"
      role="group"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <b className="text-body leading-[1.3]" id={id}>
          {title}
        </b>
        {children && <div className="text-[0.875rem] leading-[1.45] text-muted">{children}</div>}
      </div>
      {action && <div className="ml-auto shrink-0">{action}</div>}
    </div>
  );
};
