import { cva, type VariantProps } from "class-variance-authority";
import {
  Ban,
  Check,
  Circle,
  CircleHelp,
  Contrast,
  Heart,
  Hourglass,
  RefreshCw,
  ShieldAlert,
  TriangleAlert,
  X,
} from "lucide-react";
import { type ReactNode } from "react";

import { cn } from "#ui/lib/cn";

export const pillVariants = cva(
  "inline-flex w-max items-center gap-1.5 rounded-full px-2.5 py-1.5 text-small leading-none font-bold whitespace-nowrap [&_svg]:size-3.5 [&_svg]:shrink-0",
  {
    defaultVariants: { tone: "neutral" },
    variants: {
      tone: {
        danger: "bg-danger-soft text-danger",
        neutral: "bg-neutral-soft text-muted",
        ok: "bg-ok-soft text-ok",
        outline: "border-[1.5px] border-dashed border-border-strong bg-transparent text-muted",
        primary: "bg-primary-soft text-primary",
        warn: "bg-warn-soft text-warn",
      },
    },
  },
);

export type HeartbeatStatus = "drift" | "none" | "unknown" | "unreachable" | "verified";

export interface PillProps extends VariantProps<typeof pillVariants> {
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
  title?: string;
}

/** A status pill. Every status carries an icon as well as a colour. */
export const Pill = ({ children, className, icon, title, tone }: PillProps) => {
  return (
    <span className={cn(pillVariants({ tone }), className)} title={title}>
      {icon}
      {children}
    </span>
  );
};

/**
 * The shared label for a field marked `superSensitive`: wherever one shows up (a field badge,
 * the type editor, settings copy, the secret page), it reads "Highly sensitive" with a short
 * explanation on hover, never the raw field name.
 */
export const HighlySensitiveBadge = ({ className }: { className?: string }) => (
  <Pill
    className={className}
    icon={<ShieldAlert aria-hidden />}
    title="Needs a fresh second factor to reveal, and shows only a partial mask at first."
    tone="warn"
  >
    Highly sensitive
  </Pill>
);

const heartbeat: Record<
  HeartbeatStatus,
  { filled: boolean; label: string; live: boolean; tone: PillProps["tone"] }
> = {
  drift: { filled: true, label: "Drift", live: true, tone: "warn" },
  none: { filled: false, label: "No target", live: false, tone: "outline" },
  unknown: { filled: false, label: "Unknown", live: false, tone: "neutral" },
  unreachable: { filled: true, label: "Unreachable", live: true, tone: "danger" },
  verified: { filled: true, label: "Verified", live: true, tone: "ok" },
};

export type RotationStatus = "degraded" | "failed" | "rotated" | "rotating" | "unknown";

/** The heartbeat pill. The filled heart beats for live states and stops with reduced motion. */
export const HeartbeatPill = ({
  className,
  status,
}: {
  className?: string;
  status: HeartbeatStatus;
}) => {
  const h = heartbeat[status];
  return (
    <Pill
      className={className}
      icon={
        <Heart
          aria-hidden
          className={cn(h.live && "animate-heartbeat motion-reduce:animate-none")}
          fill={h.filled ? "currentColor" : "none"}
        />
      }
      tone={h.tone}
    >
      <span className="sr-only">Heartbeat: </span>
      {h.label}
    </Pill>
  );
};

const rotation: Record<
  RotationStatus,
  { icon: ReactNode; label: string; tone: PillProps["tone"] }
> = {
  degraded: { icon: <TriangleAlert aria-hidden />, label: "Degraded", tone: "warn" },
  failed: { icon: <X aria-hidden strokeWidth={3} />, label: "Failed", tone: "danger" },
  rotated: { icon: <Check aria-hidden strokeWidth={3} />, label: "Rotated", tone: "ok" },
  rotating: {
    icon: <RefreshCw aria-hidden className="animate-spin-slow motion-reduce:animate-none" />,
    label: "Rotating…",
    tone: "primary",
  },
  unknown: { icon: <CircleHelp aria-hidden />, label: "Unknown", tone: "neutral" },
};

export type GrantStatus = "active" | "expired" | "revoked" | "used";

export type RequestStatus = "approved" | "denied" | "pending";

/** Tokens and use grants: active, expired, used up or revoked (struck through). */
export const GrantPill = ({ status }: { status: GrantStatus }) => {
  if (status === "active")
    return (
      <Pill icon={<Circle aria-hidden fill="currentColor" />} tone="ok">
        Active
      </Pill>
    );
  if (status === "expired")
    return (
      <Pill icon={<Circle aria-hidden />} tone="neutral">
        Expired
      </Pill>
    );
  if (status === "used")
    return (
      <Pill icon={<Contrast aria-hidden />} tone="neutral">
        Used up
      </Pill>
    );
  return (
    <Pill className="line-through" tone="danger">
      Revoked
    </Pill>
  );
};

/** The "not rotating" explainer: no target is attached, so rotation can't run. */
export const NotRotatingPill = ({ action }: { action?: ReactNode }) => {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-warn px-3 py-1.5 text-small">
      <span className="inline-flex items-center gap-1.5 font-bold text-warn">
        <Ban aria-hidden className="size-3.5" />
        Not rotating
      </span>
      <span className="text-ink">no target with a connection</span>
      {action}
    </span>
  );
};

export const RequestPill = ({ status }: { status: RequestStatus }) => {
  if (status === "approved")
    return (
      <Pill icon={<Check aria-hidden strokeWidth={3} />} tone="ok">
        Approved
      </Pill>
    );
  if (status === "denied")
    return (
      <Pill icon={<X aria-hidden strokeWidth={3} />} tone="danger">
        Denied
      </Pill>
    );
  return (
    <Pill icon={<Hourglass aria-hidden />} tone="primary">
      Pending
    </Pill>
  );
};

export const RotationPill = ({
  className,
  status,
}: {
  className?: string;
  status: RotationStatus;
}) => {
  const r = rotation[status];
  return (
    <Pill className={className} icon={r.icon} tone={r.tone}>
      <span className="sr-only">Rotation: </span>
      {r.label}
    </Pill>
  );
};

const badgeVariants = cva(
  "inline-flex w-max items-center gap-1 rounded-xs px-2 py-1 text-[0.75rem] leading-none font-bold whitespace-nowrap [&_svg]:size-3",
  {
    defaultVariants: { tone: "neutral" },
    variants: {
      tone: {
        ink: "bg-ink text-bg",
        neutral: "border border-border-strong bg-surface text-ink",
        ok: "border-[1.5px] border-ok text-ok",
        primary: "bg-primary-soft text-primary",
        sole: "bg-warn-soft text-warn",
        sunken: "bg-sunken text-ink",
        warn: "border-[1.5px] border-dashed border-warn text-warn",
      },
    },
  },
);

export const Badge = ({
  children,
  className,
  icon,
  tone,
}: { children: ReactNode; className?: string; icon?: ReactNode } & VariantProps<
  typeof badgeVariants
>) => {
  return (
    <span className={cn(badgeVariants({ tone }), className)}>
      {icon}
      {children}
    </span>
  );
};

/** A count bubble for nav items and buttons. */
export const CountBadge = ({
  className,
  count,
  tone = "primary",
}: {
  className?: string;
  count: number;
  tone?: "danger" | "muted" | "primary";
}) => {
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[0.75rem] leading-none font-bold",
        tone === "primary" && "bg-primary text-on-primary",
        tone === "danger" && "bg-danger text-on-danger",
        tone === "muted" && "bg-transparent font-mono text-muted",
        className,
      )}
    >
      {count}
    </span>
  );
};
