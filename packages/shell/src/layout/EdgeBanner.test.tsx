/* eslint-disable testing-library/no-container, testing-library/no-node-access -- these check the drawn SVG and the absence of an element, which have no accessible role to query. */
import { DEFAULT_DISPLAY } from "@sneakers-web/ui";
import { render, screen } from "@testing-library/react";
import { createRoutesStub, Outlet } from "react-router";

import { EdgeBanner } from "#shell/layout/EdgeBanner";

const withBanner = (banner: null | string) =>
  createRoutesStub([
    {
      children: [{ Component: EdgeBanner, index: true }],
      Component: Outlet,
      HydrateFallback: () => null,
      id: "root",
      loader: () => ({
        banner,
        config: {
          adminUrl: "/admin/",
          appEnv: "dev",
          logLevel: "error",
          sso: true,
          staffUrl: "/",
          version: "0",
        },
        display: DEFAULT_DISPLAY,
        needsSetup: false,
        storagePrefix: banner ? "mock:" : "",
      }),
      path: "/",
    },
  ]);

describe("EdgeBanner", () => {
  it("is impossible to miss in a mock build", async () => {
    const Stub = withBanner("MOCK DATA, not a real server");
    render(<Stub initialEntries={["/"]} />);
    expect(await screen.findByRole("note")).toHaveTextContent("MOCK DATA, not a real server");
  });

  it("renders nothing in a live build", async () => {
    const Stub = withBanner(null);
    const { container } = render(<Stub initialEntries={["/"]} />);
    await new Promise((r) => setTimeout(r, 50));
    expect(container.querySelector("[data-testid=edge-banner]")).toBeNull();
  });
});
