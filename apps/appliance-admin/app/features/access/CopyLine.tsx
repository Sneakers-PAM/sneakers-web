import { Button, toast } from "@sneakers-web/ui";
import { ClipboardCopy } from "lucide-react";

/**
 * One line to paste somewhere (a command, a known_hosts line, a public key), with Copy. Shown
 * with an ellipsis, not wrapped across lines: Copy still copies the value in full, and the
 * full line sits in a tooltip.
 */
export const CopyLine = ({
  copied,
  label = "Copy",
  value,
}: {
  /** What the toast says once it's on the clipboard. */
  copied: string;
  /** The button's name; each Copy on a page needs its own. */
  label?: string;
  value: string;
}) => (
  <div className="flex min-w-0 flex-wrap items-start gap-2">
    <code
      className="block min-w-0 flex-1 truncate rounded-md bg-sunken px-2 py-1 font-mono text-[0.8125rem]"
      title={value}
    >
      {value}
    </code>
    <Button
      aria-label={label}
      onClick={() => {
        void navigator.clipboard
          .writeText(value)
          .then(() => toast(copied))
          .catch(() => toast("Couldn't copy. Try again."));
      }}
      size="sm"
      variant="secondary"
    >
      <ClipboardCopy aria-hidden />
      Copy
    </Button>
  </div>
);
