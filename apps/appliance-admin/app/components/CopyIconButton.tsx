import { Button, toast } from "@sneakers-web/ui";
import { ClipboardCopy } from "lucide-react";

/**
 * A small icon-only Copy, for a value that's already shown in full (or as a short name) so it
 * doesn't need its own line: clicking it copies the exact value and says so with a toast,
 * instead of opening anything.
 */
export const CopyIconButton = ({ label, value }: { label: string; value: string }) => (
  <Button
    aria-label={label}
    onClick={() => {
      void navigator.clipboard
        .writeText(value)
        .then(() => toast(`${label} copied.`))
        .catch(() => toast.error("Couldn't copy. Try again."));
    }}
    size="icon-sm"
    variant="secondary"
  >
    <ClipboardCopy aria-hidden />
  </Button>
);
