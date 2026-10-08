import { Button, type ButtonProps } from "@sneakers-web/ui";
import { ClipboardCopy } from "lucide-react";
import { createContext, type ReactNode, useContext, useState } from "react";
import { useHref, useInRouterContext } from "react-router";

import type { Problem } from "#shell/diagnostics/report";

import { copyDiagnostics, copyWithNotice, DIAGNOSTICS_ROUTE } from "#shell/diagnostics/copy";

/** Builds the report for a problem, puts it on the clipboard and returns the copied text. */
export type DiagnosticsCopier = (options: { problem?: Problem; url: string }) => Promise<string>;

const Copier = createContext<DiagnosticsCopier>(copyDiagnostics);

/**
 * An app whose diagnostics don't come from the app server's resources/diagnostics (the
 * appliance admin, a static app with no gateway) gives its own copier here, so every Copy
 * diagnostics button below, the crash and error screens included, copies that app's report.
 */
export const DiagnosticsCopierProvider = Copier.Provider;

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
  const copy = useContext(Copier);
  return (
    <DiagnosticsUrl>
      {(url) => (
        <Button
          loading={busy}
          loadingLabel="Copying…"
          onClick={() => {
            setBusy(true);
            void copyWithNotice({ problem, url }, copy).finally(() => setBusy(false));
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
