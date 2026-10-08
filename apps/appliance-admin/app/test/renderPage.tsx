import type { ComponentType } from "react";

import { Toaster, TooltipProvider } from "@sneakers-web/ui";
import { render } from "@testing-library/react";
import { createRoutesStub } from "react-router";

/** Mounts one page component standalone, the way a signed-in admin reaches it. */
export const renderPage = (Component: ComponentType, path = "/") => {
  const Stub = createRoutesStub([{ Component, path }]);
  return render(
    <TooltipProvider>
      <Stub initialEntries={[path]} />
      <Toaster position="bottom-center" />
    </TooltipProvider>,
  );
};
