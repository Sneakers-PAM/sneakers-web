import { cn } from "#ui/lib/cn";

export const MARK_BODY = "M6 43c0-13 4-25 13-27h8c2 8 9 13 18 14l8 2c5 1 7 5 7 9v2H6z";

export interface MarkProps {
  className?: string;
  /** The colour the keyhole shows through to, usually the surface the mark sits on. */
  hole?: string;
  /** Ink for the shoe body; defaults to the theme ink. */
  ink?: string;
  size?: number;
  /** Accessible name; omit for a decorative mark. */
  title?: string;
}

/** Mark and wordmark together, as in the app header and the sign-in panel. */
export const Brand = ({
  className,
  hole,
  ink,
  size = 30,
  wordmarkClassName,
}: {
  className?: string;
  hole?: string;
  ink?: string;
  size?: number;
  wordmarkClassName?: string;
}) => {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Mark hole={hole} ink={ink} size={size} />
      <Wordmark className={wordmarkClassName} />
      <span className="sr-only">Sneakers-PAM</span>
    </span>
  );
};

/** DEV or QA badge. Hatched, ink-bordered, and never a status colour. Production shows nothing. */
export const EnvironmentTag = ({ className, env }: { className?: string; env: string }) => {
  return (
    <span
      className={cn(
        "env-hatch inline-block rounded-[6px] border-[1.5px] border-ink px-2 py-[5px] font-mono text-[0.6875rem] leading-none font-bold tracking-[0.08em] text-ink uppercase",
        className,
      )}
    >
      {env}
    </span>
  );
};

/**
 * The Laces mark: a sneaker in ink on an orange sole, with a keyhole for an eyelet.
 * Small sizes simplify it the way the brand asks: a round hole at 32 px and below,
 * no hole at 16 px.
 */
export const Mark = ({
  className,
  hole = "var(--color-surface)",
  ink = "var(--color-ink)",
  size = 30,
  title,
}: MarkProps) => {
  return (
    <svg
      aria-hidden={title ? undefined : true}
      aria-label={title}
      className={cn("shrink-0", className)}
      height={size}
      role={title ? "img" : undefined}
      viewBox="0 0 64 64"
      width={size}
    >
      <path d={MARK_BODY} style={{ fill: ink }} />
      <rect height="10" rx="5" style={{ fill: "var(--color-sole)" }} width="58" x="4" y="44" />
      {size > 32 ? (
        <>
          <circle cx="19" cy="29" r="4.2" style={{ fill: hole }} />
          <rect height="8" rx="1.2" style={{ fill: hole }} width="3.2" x="17.4" y="30" />
        </>
      ) : size > 16 ? (
        <circle cx="19" cy="30" r="5" style={{ fill: hole }} />
      ) : null}
    </svg>
  );
};

/** The name treatment: sneakers·pam in Bricolage Grotesque 800, the dot in the sole colour. */
export const Wordmark = ({ className }: { className?: string }) => {
  return (
    <span
      className={cn(
        "font-display text-[1.3125rem] leading-none font-extrabold tracking-[-0.02em] whitespace-nowrap",
        className,
      )}
    >
      sneakers<span className="text-sole">·</span>pam
    </span>
  );
};
