import { MOCK_GATEWAY_URL, mockAppliance, mockState } from "@sneakers-web/mock-gateway";
import {
  server,
  sessionCookie,
  withCookie,
  withMockGateway,
} from "@sneakers-web/mock-gateway/testing";
import { ProblemActions } from "@sneakers-web/shell";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { graphql } from "msw/graphql";
import { createRoutesStub } from "react-router";

import { StaffFrame } from "@/frame/StaffFrame";
import * as browse from "@/routes/browse";
import { loader as frameLoader } from "@/routes/frame";

withMockGateway();

/** Mounts the real staff frame, with its real loader run against the mock gateway. */
const openFrame = () => {
  const cookie = sessionCookie("mock-user-alice");
  const Stub = createRoutesStub([
    {
      children: [{ Component: () => <h1>Dashboard</h1>, index: true }],
      Component: () => (
        <ProblemActions>
          <StaffFrame />
        </ProblemActions>
      ),
      id: "routes/frame",
      loader: withCookie(cookie, frameLoader),
    },
  ]);
  return render(<Stub initialEntries={["/"]} />);
};

describe("StaffFrame appliance banners", () => {
  it("shows neither banner on a plain install", async () => {
    openFrame();
    await screen.findByText("Dashboard");
    expect(screen.queryByRole("status", { name: "MCP status" })).toBeNull();
    expect(screen.queryByRole("status", { name: "Maintenance mode" })).toBeNull();
  });

  it("shows the MCP-off notice when the appliance says the MCP is off", async () => {
    mockAppliance.current = { ...mockAppliance.current, mcp: "off" };
    openFrame();
    expect(await screen.findByRole("status", { name: "MCP status" })).toHaveTextContent(
      "MCP: off.",
    );
    expect(screen.queryByRole("status", { name: "Maintenance mode" })).toBeNull();
  });

  it("shows the maintenance banner and reason when the appliance is in maintenance", async () => {
    mockAppliance.current = {
      ...mockAppliance.current,
      maintenance: true,
      maintenanceReason: "Upgrading to v2.0",
    };
    openFrame();
    expect(await screen.findByRole("status", { name: "Maintenance mode" })).toHaveTextContent(
      "Upgrading to v2.0",
    );
    expect(screen.queryByRole("status", { name: "MCP status" })).toBeNull();
  });
});

/**
 * The real frame wrapping the real browse routes, so the sidebar's folder tree - moved out of
 * the browse page and into the frame for U-03 - can be exercised as it's actually wired: present
 * on every page, posting its mutations to `/browse` since there's no route in context to default
 * to off that route.
 */
const open = (url: string, user = "mock-user-alice") => {
  const cookie = sessionCookie(user);
  const browsePage = {
    action: withCookie(cookie, browse.action),
    Component: browse.default,
    ErrorBoundary: browse.ErrorBoundary,
    loader: withCookie(cookie, browse.loader),
  };
  const Stub = createRoutesStub([
    {
      children: [
        { Component: () => <p>Dashboard</p>, HydrateFallback: () => null, index: true },
        { ...browsePage, id: "routes/browse", path: "/browse" },
        { ...browsePage, id: "routes/browse-folder", path: "/browse/:folderId" },
      ],
      Component: StaffFrame,
      HydrateFallback: () => null,
      id: "routes/frame",
      loader: withCookie(cookie, frameLoader),
    } as never,
  ]);
  return render(<Stub initialEntries={[url]} />);
};

const nav = () => screen.getByRole("navigation", { name: "Folders" });

// jsdom's `matchMedia` always answers false (no real viewport), so `useBreakpoint` reads every
// test as a phone: the sidebar renders inside the drawer, which starts closed.
const openDrawer = async () =>
  userEvent.click(await screen.findByRole("button", { name: "Open menu" }));

const nothing = () => {};

/** A promise the test resolves when it's ready, to hold a mock answer back. */
const gated = () => {
  const box = { release: nothing };
  const gate = new Promise<void>((resolve) => {
    box.release = resolve;
  });
  return { gate, release: () => box.release() };
};

const folderMenu = async (name: string, item: string) => {
  const user = userEvent.setup();
  await user.pointer({ keys: "[MouseRight]", target: within(nav()).getByText(name) });
  await user.click(await screen.findByRole("menuitem", { name: item }));
  return user;
};

describe("the folder tree in the frame sidebar", () => {
  it("is there from a page that isn't browse, personal pinned and shared as a tree", async () => {
    open("/");
    await screen.findByText("Dashboard");
    await openDrawer();
    expect(within(nav()).getByRole("link", { name: /My secrets/ })).toBeInTheDocument();
    expect(within(nav()).getByRole("link", { name: /Lab/ })).toBeInTheDocument();
    // Shared folders show fully expanded, parent and child together, with no drill-in step.
    expect(within(nav()).getByRole("link", { name: /Platform/ })).toBeInTheDocument();
    expect(within(nav()).getByRole("link", { name: /Databases/ })).toBeInTheDocument();
    expect(within(nav()).getByRole("link", { name: /Network/ })).toBeInTheDocument();
    expect(within(nav()).getByRole("link", { name: /Finance/ })).toBeInTheDocument();
    expect(within(nav()).getByRole("link", { name: /Archive/ })).toBeInTheDocument();
    expect(within(nav()).getByRole("link", { name: /Helpdesk/ })).toBeInTheDocument();
  });

  it("opens a folder from the sidebar, from a page that isn't browse", async () => {
    open("/");
    await screen.findByText("Dashboard");
    await openDrawer();
    const user = userEvent.setup();
    await user.click(within(nav()).getByRole("link", { name: /Databases/ }));
    expect(await screen.findByRole("heading", { name: "Databases" })).toBeInTheDocument();
  });

  it("marks the open folder current in the tree", async () => {
    open("/browse/mock-folder-databases");
    await screen.findByRole("heading", { name: "Databases" });
    await openDrawer();
    expect(within(nav()).getByRole("link", { current: "page", name: /Databases/ })).toBeVisible();
  });

  it("shows a skeleton while switching from one open folder to another", async () => {
    open("/browse/mock-folder-databases");
    await screen.findByRole("heading", { name: "Databases" });
    await openDrawer();
    const { gate, release } = gated();
    server.use(
      graphql.link(`${MOCK_GATEWAY_URL}/graphql`).query(
        "BrowseFolders",
        async () => {
          // Hold the answer, then fall through to the mock gateway's own handler.
          await gate;
        },
        { once: true },
      ),
    );
    await userEvent.click(within(nav()).getByRole("link", { name: /Network/ }));
    expect(await screen.findByTestId("browse-skeleton")).toBeInTheDocument();
    release();
    expect(await screen.findByRole("heading", { name: "Network" })).toBeInTheDocument();
  });

  it("renames a folder from the sidebar's actions menu, off the browse route", async () => {
    open("/");
    await screen.findByText("Dashboard");
    await openDrawer();
    const user = await folderMenu("Databases", "Rename…");
    const dialog = await screen.findByRole("dialog", { name: "Rename folder" });
    const name = within(dialog).getByLabelText("Name");
    await user.clear(name);
    await user.type(name, "Data stores");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Rename folder" })).not.toBeInTheDocument(),
    );
    expect(mockState.world.folders.find((f) => f.id === "mock-folder-databases")?.name).toBe(
      "Data stores",
    );
    expect(await within(nav()).findByRole("link", { name: /Data stores/ })).toBeInTheDocument();
  });

  it("reorders a folder from the sidebar, off the browse route", async () => {
    open("/");
    await screen.findByText("Dashboard");
    await openDrawer();
    await folderMenu("Databases", "Move down");
    await waitFor(() =>
      expect(mockState.world.folders.find((f) => f.id === "mock-folder-network")?.order).toBe(0),
    );
    expect(mockState.world.folders.find((f) => f.id === "mock-folder-databases")?.order).toBe(1);
  });

  it("doesn't break with no folders at all", async () => {
    mockState.world.folders = [];
    open("/");
    await screen.findByText("Dashboard");
    await openDrawer();
    expect(within(nav()).getByText("No shared folders yet.")).toBeInTheDocument();
  });
});
