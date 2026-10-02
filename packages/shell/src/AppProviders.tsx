import { storageKey } from "@sneakers-web/api-client";
import { LiveRegion, ThemeProvider, Toaster, TooltipProvider } from "@sneakers-web/ui";
import { QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { BrowserRouter } from "react-router";

import { CrashBoundary } from "#shell/CrashScreen";
import { createQueryClient } from "#shell/data/queryClient";

/** The providers every app sits in: theme, data cache, router, tooltips, toasts and the crash net. */
export const AppProviders = ({ basename, children }: { basename: string; children: ReactNode }) => {
  const [client] = useState(createQueryClient);
  return (
    <ThemeProvider storageKey={storageKey("display")}>
      <CrashBoundary>
        <QueryClientProvider client={client}>
          <BrowserRouter basename={basename}>
            <TooltipProvider>
              {children}
              <Toaster />
              <LiveRegion />
            </TooltipProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </CrashBoundary>
    </ThemeProvider>
  );
};
