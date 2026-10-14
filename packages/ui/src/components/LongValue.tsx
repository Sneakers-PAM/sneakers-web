import { Copy } from "lucide-react";

import { Button } from "#ui/components/Button";
import { toast } from "#ui/components/Toast";
import { cn } from "#ui/lib/cn";

export interface LongValueProps {
  /** Rendered element for the value itself; a block context (a `dd`, a table cell) wants "p". */
  as?: "p" | "span";
  className?: string;
  /** Shows a Copy button labelled "Copy {copyLabel}" and sends the exact, untouched value. */
  copyLabel?: string;
  /** Keeps the value's own line breaks (an SSH key, a PEM block) instead of running them together. */
  multiline?: boolean;
  value: string;
}

/**
 * A long unbroken value - a fingerprint, token, hash, URL, path or key - that wraps inside its
 * own box instead of forcing its dialog, card or table to scroll sideways. Monospace, so every
 * character is unambiguous; Copy, when asked for, always sends the exact value, never a
 * truncated or re-wrapped one.
 */
export const LongValue = ({
  as = "span",
  className,
  copyLabel,
  multiline,
  value,
}: LongValueProps) => {
  const Tag = as;
  const text = (
    <Tag
      className={cn(
        "min-w-0 flex-1 font-mono wrap-anywhere",
        multiline && "whitespace-pre-wrap",
        !copyLabel && className,
      )}
    >
      {value}
    </Tag>
  );
  if (!copyLabel) return text;
  return (
    <span className={cn("flex min-w-0 items-start gap-3", className)}>
      {text}
      <Button
        aria-label={`Copy ${copyLabel}`}
        className="shrink-0"
        onClick={() =>
          void navigator.clipboard
            .writeText(value)
            .then(() => toast(`${copyLabel} copied.`))
            .catch(() => toast.error("Couldn't copy."))
        }
        size="sm"
        variant="secondary"
      >
        <Copy aria-hidden />
        Copy
      </Button>
    </span>
  );
};
