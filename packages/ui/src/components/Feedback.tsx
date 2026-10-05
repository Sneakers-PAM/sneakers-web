import { cva, type VariantProps } from "class-variance-authority";
import { AlertTriangle, Check, Info, X } from "lucide-react";
import { type ReactNode } from "react";

import { useProblemAction } from "#ui/components/ProblemAction";
import { cn } from "#ui/lib/cn";

const alertVariants = cva(
  "flex gap-3 rounded-lg border-[1.5px] px-4 py-3.5 text-[0.875rem] leading-[1.45]",
  {
    defaultVariants: { tone: "info" },
    variants: {
      tone: {
        danger: "border-danger bg-danger-soft",
        info: "border-primary bg-primary-soft",
        ok: "border-ok bg-ok-soft",
        warn: "border-warn bg-warn-soft",
      },
    },
  },
);

const toneIcon = {
  danger: <X aria-hidden className="mt-0.5 size-4 shrink-0 text-danger" strokeWidth={3} />,
  info: <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={2.5} />,
  ok: <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-ok" strokeWidth={3} />,
  warn: (
    <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-warn" strokeWidth={2.5} />
  ),
};

export interface AlertProps extends VariantProps<typeof alertVariants> {
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
  /** "alert" for errors that just happened; "status" for calm notices. */
  role?: "alert" | "status";
  title?: ReactNode;
}

const textOf = (node: ReactNode): string | undefined =>
  typeof node === "string" || typeof node === "number" ? String(node) : undefined;

export const Alert = ({ action, children, className, role, title, tone }: AlertProps) => {
  const t = tone ?? "info";
  const problem = useProblemAction();
  const offer = problem && (t === "danger" || t === "warn");
  return (
    <div
      className={cn(alertVariants({ tone: t }), className)}
      role={role ?? (t === "danger" ? "alert" : "status")}
    >
      {toneIcon[t]}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {title && <b className="text-body leading-[1.3]">{title}</b>}
        {children && <div>{children}</div>}
      </div>
      {(action || offer) && (
        <div className="ml-2 flex items-center gap-3 self-center">
          {action}
          {offer && (
            <button
              className="text-small font-bold whitespace-nowrap text-primary underline-offset-2 hover:underline"
              onClick={() => void problem.run(textOf(children) ?? textOf(title))}
              type="button"
            >
              {problem.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export const Card = ({ className, ...props }: React.ComponentProps<"section">) => {
  return (
    <section
      className={cn("rounded-xl border border-border bg-surface text-ink", className)}
      {...props}
    />
  );
};

export const CardHeader = ({
  aside,
  className,
  subtitle,
  title,
}: {
  aside?: ReactNode;
  className?: string;
  subtitle?: ReactNode;
  title: ReactNode;
}) => {
  return (
    <div
      className={cn("flex items-baseline gap-3 border-b border-border px-5.5 py-4.5", className)}
    >
      <h2 className="m-0 font-display text-[1.25rem] leading-none font-bold">{title}</h2>
      {subtitle && <span className="text-[0.875rem] text-muted">{subtitle}</span>}
      {aside && <div className="ml-auto">{aside}</div>}
    </div>
  );
};

export const Skeleton = ({ className }: { className?: string }) => {
  return (
    <span
      aria-hidden
      className={cn(
        "block animate-pulse rounded-sm bg-sunken motion-reduce:animate-none",
        className,
      )}
    />
  );
};
