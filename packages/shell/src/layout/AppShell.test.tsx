import { DEFAULT_DISPLAY } from "@sneakers-web/ui";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub, Link, Outlet } from "react-router";

import { AppShell } from "#shell/layout/AppShell";

/** Simulate a screen of `widthPx`: every `min-width` media query answers for that width. */
const atWidth = (widthPx: number): (() => void) => {
  const original = globalThis.matchMedia;
  globalThis.matchMedia = ((query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    return {
      addEventListener: () => {},
      addListener: () => {},
      dispatchEvent: () => false,
      matches: min ? widthPx >= Number(min[1]) : false,
      media: query,
      onchange: null,
      removeEventListener: () => {},
      removeListener: () => {},
    };
  }) as typeof globalThis.matchMedia;
  return () => {
    globalThis.matchMedia = original;
  };
};

const withShell = ({ linkToOther = false }: { linkToOther?: boolean } = {}) =>
  createRoutesStub([
    {
      children: [
        {
          Component: () => (
            <AppShell
              account={<span>Account</span>}
              home="/"
              sidebar={() => (
                <nav>
                  Nav
                  {linkToOther && <Link to="/other">Other page</Link>}
                </nav>
              )}
            >
              <p>Content</p>
            </AppShell>
          ),
          index: true,
        },
        {
          Component: () => (
            <AppShell account={<span>Account</span>} home="/" sidebar={() => <nav>Nav</nav>}>
              <p>Other content</p>
            </AppShell>
          ),
          path: "other",
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

describe("AppShell's sidebar breakpoint", () => {
  it.each([
    ["an iPad Mini", 768],
    ["an iPad Pro 13 in portrait", 1024],
    ["an iPad Pro 13 in landscape", 1366],
  ])("is a drawer, not a fixed rail, at %s (%dpx)", async (_label, widthPx) => {
    const restore = atWidth(widthPx);
    const Stub = withShell();
    render(<Stub initialEntries={["/"]} />);
    const trigger = await screen.findByRole("button", { name: "Open menu" });
    expect(screen.queryByRole("complementary", { name: "Sidebar" })).toBeNull();
    const user = userEvent.setup();
    await user.click(trigger);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Nav")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    restore();
  });

  it("closes the drawer on navigate, at a tablet width", async () => {
    const restore = atWidth(768);
    const Stub = withShell({ linkToOther: true });
    render(<Stub initialEntries={["/"]} />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Open menu" }));
    await screen.findByRole("dialog");
    await user.click(screen.getByRole("link", { name: "Other page" }));
    expect(await screen.findByText("Other content")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
    restore();
  });

  it("is a fixed rail, not a drawer, at a wide desktop width", async () => {
    const restore = atWidth(1440);
    const Stub = withShell();
    render(<Stub initialEntries={["/"]} />);
    expect(await screen.findByRole("complementary", { name: "Sidebar" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open menu" })).toBeNull();
    expect(
      screen.getByRole("button", { name: /Collapse sidebar|Expand sidebar/ }),
    ).toBeInTheDocument();
    restore();
  });
});
