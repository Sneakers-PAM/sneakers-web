import { refusalMessage } from "@sneakers-web/shell";
import { Card, cn, toast } from "@sneakers-web/ui";
import { type ReactNode, useEffect, useRef } from "react";

import type { ActionResult } from "@/lib/admin.server";

/** Toast each new action result once: the note when it worked, the reason when it didn't. */
export const useResultToast = (result: ActionResult | undefined): void => {
  const shown = useRef<ActionResult | undefined>(undefined);
  useEffect(() => {
    if (!result || shown.current === result) return;
    shown.current = result;
    if (result.ok) {
      if (result.done) toast(result.done);
    } else {
      toast.error(refusalMessage(result.refusal));
    }
  }, [result]);
};

/** A console card with its title inside, as the Laces admin frames draw them. */
export const Panel = ({
  aside,
  children,
  className,
  flush,
  title,
}: {
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  /** No inner padding below the title, for lists and tables that run edge to edge. */
  flush?: boolean;
  title?: ReactNode;
}) => (
  <Card className={cn("flex flex-col", !flush && "gap-4 p-5.5", className)}>
    {title && (
      <div className={cn("flex items-center gap-3", flush && "px-5.5 pt-5 pb-4")}>
        <h2 className="m-0 font-display text-[1.375rem] leading-[1.2] font-bold">{title}</h2>
        {aside && <div className="ml-auto flex items-center gap-2">{aside}</div>}
      </div>
    )}
    {children}
  </Card>
);

/** One setting: its name and what it does on the left, the control on the right. */
export const SettingRow = ({
  body,
  control,
  id,
  title,
}: {
  body: ReactNode;
  control: ReactNode;
  id?: string;
  title: ReactNode;
}) => (
  <div className="flex items-start gap-4 border-t border-border pt-4 first:border-t-0 first:pt-0">
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <b className="text-body" id={id}>
        {title}
      </b>
      <span className="text-small text-muted">{body}</span>
    </div>
    <div className="shrink-0">{control}</div>
  </div>
);
