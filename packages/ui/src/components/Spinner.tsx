import { cn } from "#ui/lib/cn";

/** The Laces ring spinner. It stops turning when motion is reduced. */
export const Spinner = ({ className, label }: { className?: string; label?: string }) => {
  return (
    <span
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={cn(
        "inline-block size-5.5 shrink-0 animate-spin rounded-full border-3 border-primary-soft border-t-primary",
        className,
      )}
      role={label ? "status" : undefined}
    />
  );
};
