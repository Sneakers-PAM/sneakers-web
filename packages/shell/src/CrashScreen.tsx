import { createLogger } from "@sneakers-web/api-client";
import { Button } from "@sneakers-web/ui";
import { ChevronDown, Copy, X } from "lucide-react";
import { useEffect, useState } from "react";

import { CopyDiagnostics } from "#shell/diagnostics/CopyDiagnostics";
import { CenteredFrame } from "#shell/gate/Frames";

const log = createLogger("crash");

/** G-04: something threw while rendering. Offers a reload, a way back and the technical detail. */
export const CrashScreen = ({ error }: { error: Error }) => {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    log.error("page crashed", { error: error.name });
  }, [error]);
  const stack = error.stack ? `\n${error.stack.split("\n").slice(1, 6).join("\n")}` : "";
  const detail = `${error.name}: ${error.message}${stack}`;
  return (
    <CenteredFrame>
      <div className="flex items-start gap-3.5">
        <span
          aria-hidden
          className="flex size-10 flex-none items-center justify-center rounded-lg bg-danger text-on-danger"
        >
          <X className="size-5" strokeWidth={3} />
        </span>
        <div className="flex flex-col gap-2">
          <h1 className="m-0 font-display text-[1.5rem] leading-[1.15] font-bold">
            Something broke
          </h1>
          <p className="m-0 text-body leading-[1.5] text-muted">
            The page hit an error it could not recover from. Nothing you saved is lost.
          </p>
        </div>
      </div>
      <div className="rounded-lg border border-border">
        <div className="flex items-center px-3.5 py-2.5">
          <button
            aria-expanded={open}
            className="inline-flex items-center gap-1.5 text-[0.875rem] font-bold"
            onClick={() => setOpen((v) => !v)}
            type="button"
          >
            <ChevronDown aria-hidden className={open ? "size-4" : "size-4 -rotate-90"} />
            Technical detail
          </button>
          <button
            className="ml-auto inline-flex items-center gap-1.5 text-[0.875rem] font-bold text-primary"
            onClick={() => void navigator.clipboard?.writeText(detail)}
            type="button"
          >
            <Copy aria-hidden className="size-4" />
            Copy
          </button>
        </div>
        {open && (
          <pre className="m-0 overflow-x-auto rounded-b-lg bg-term-bg px-3.5 py-3 font-mono text-[0.75rem] leading-[1.6] whitespace-pre text-term-fg">
            {detail}
          </pre>
        )}
      </div>
      <div className="flex flex-wrap gap-2.5">
        <Button onClick={() => globalThis.location.reload()}>Reload page</Button>
        <Button onClick={() => globalThis.history.back()} variant="secondary">
          Go back
        </Button>
        <CopyDiagnostics problem={{ message: `Page crashed: ${error.name}` }} size="md" />
      </div>
    </CenteredFrame>
  );
};
