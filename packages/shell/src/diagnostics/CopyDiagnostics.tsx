import { Button, type ButtonProps } from "@sneakers-web/ui";
import { ClipboardCopy } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useHref, useInRouterContext } from "react-router";

import type { Problem } from "#shell/diagnostics/report";

import { copyWithNotice, DIAGNOSTICS_ROUTE } from "#shell/diagnostics/copy";

const Routed = ({ children }: { children: (url: string) => ReactNode }) => (
  <>{children(useHref(DIAGNOSTICS_ROUTE))}</>
);

/** The diagnostics URL under the app's base path; the plain path outside a router. */
export const DiagnosticsUrl = ({ children }: { children: (url: string) => ReactNode }) =>
  useInRouterContext() ? <Routed>{children}</Routed> : <>{children(DIAGNOSTICS_ROUTE)}</>;

/**
 * Copies everything support needs to place a problem: time, page, the refused operation, the
 * user, and every build the gateway knows. Never a token, cookie or field value.
 */
export const CopyDiagnostics = ({
  problem,
  size = "sm",
  variant = "secondary",
}: {
  problem?: Problem;
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
}) => {
  const [busy, setBusy] = useState(false);
  return (
    <DiagnosticsUrl>
      {(url) => (
        <Button
          loading={busy}
          loadingLabel="Copying…"
          onClick={() => {
            setBusy(true);
            void copyWithNotice({ problem, url }).finally(() => setBusy(false));
          }}
          size={size}
          variant={variant}
        >
          <ClipboardCopy aria-hidden />
          Copy diagnostics
        </Button>
      )}
    </DiagnosticsUrl>
  );
};
