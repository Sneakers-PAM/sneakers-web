import { type ReactNode } from "react";

import { SneakerLoader } from "#ui/brand/SneakerLoader";
import { cn } from "#ui/lib/cn";

/** A square initial tile used for people in menus, lists and notifications. */
export const Avatar = ({
  className,
  name,
  size = 32,
  tone = "primary",
}: {
  className?: string;
  name: string;
  size?: number;
  tone?: "neutral" | "ok" | "primary" | "warn";
}) => {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block shrink-0 rounded-[9px] text-center font-display font-extrabold",
        tone === "primary" && "bg-primary-soft text-primary",
        tone === "ok" && "bg-ok-soft text-ok",
        tone === "warn" && "bg-warn-soft text-warn",
        tone === "neutral" && "bg-neutral-soft text-ink",
        className,
      )}
      style={{
        fontSize: Math.round(size * 0.47),
        height: size,
        lineHeight: `${size}px`,
        width: size,
      }}
    >
      {initial}
    </span>
  );
};

/** Every list's empty state: a calm title, one line of help, and the next step. */
export const EmptyState = ({
  action,
  body,
  className,
  loader = true,
  title,
}: {
  action?: ReactNode;
  body?: ReactNode;
  className?: string;
  loader?: boolean;
  title: ReactNode;
}) => {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-xl border-[1.5px] border-dashed border-border-strong px-6 py-10 text-center",
        className,
      )}
    >
      {loader && <SneakerLoader hole="var(--color-surface)" size={56} />}
      <b className="font-display text-[1.0625rem] leading-[1.2] font-bold">{title}</b>
      {body && <span className="max-w-md text-[0.875rem] leading-[1.45] text-muted">{body}</span>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
};

/** Eyebrow, page title and an optional subtitle, with actions on the right. */
export const PageHeader = ({
  actions,
  className,
  eyebrow,
  subtitle,
  title,
}: {
  actions?: ReactNode;
  className?: string;
  eyebrow?: ReactNode;
  subtitle?: ReactNode;
  title: ReactNode;
}) => {
  return (
    <div className={cn("flex flex-wrap items-end gap-4", className)}>
      <div className="flex min-w-0 flex-col gap-2">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1 className="m-0 font-display text-[1.75rem] leading-[1.05] font-bold tracking-[-0.02em] desktop:text-title">
          {title}
        </h1>
        {subtitle && <span className="text-[1rem] leading-[1.4] text-muted">{subtitle}</span>}
      </div>
      {actions && <div className="ml-auto flex flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  );
};

/** Visually hidden, but read by screen readers. */
export const VisuallyHidden = ({ children }: { children: ReactNode }) => {
  return <span className="sr-only">{children}</span>;
};
