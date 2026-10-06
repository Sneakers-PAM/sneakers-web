import { DEFAULT_DISPLAY } from "@sneakers-web/ui";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub, Outlet } from "react-router";

import { AppShell } from "#shell/layout/AppShell";

const withShell = () =>
  createRoutesStub([
    {
      children: [
        {
          Component: () => (
            <AppShell account={<span>Account</span>} home="/" sidebar={() => <nav>Nav</nav>}>
              <p>Content</p>
            </AppShell>
          ),
          index: true,
        },
      ],
      Component: Outlet,
      HydrateFallback: () => null,
      id: "root",
      loader: () => ({
        banner: null,
        config: {
          adminUrl: "/admin/",
          appEnv: "dev",
          logLevel: "error",
          sso: true,
          staffUrl: "/",
          version: "0",
        },
        developmentUiIssueCopy: false,
        display: DEFAULT_DISPLAY,
        needsSetup: false,
        storagePrefix: "",
      }),
      path: "/",
    },
  ]);

describe("AppShell display settings placement", () => {
  it("sits fixed at the bottom-right, never over content, regardless of the sidebar", async () => {
    const Stub = withShell();
    const { container } = render(<Stub initialEntries={["/"]} />);
    const trigger = await screen.findByRole("button", { name: "Accessibility settings" });
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- finding the positioned wrapper, which has no role.
    const positioned = container.querySelector(".fixed");
    expect(positioned).toHaveClass("right-4", "bottom-4");
    expect(positioned).not.toHaveClass("left-4", "left-22", "left-70", "left-73");

    // Toggling the sidebar/drawer doesn't move the widget: it isn't tracking the rail.
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /menu|sidebar/i }));
    expect(trigger).toBeInTheDocument();
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- same positioned wrapper, re-checked after the toggle.
    expect(container.querySelector(".fixed")).toHaveClass("right-4", "bottom-4");
  });
});
