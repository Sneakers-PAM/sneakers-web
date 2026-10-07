import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@sneakers-web/ui";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";

import { ISSUE_COPY_MARKER, IssueCopyMenuItem } from "#shell/issueCopy/IssueCopyMenuItem";

const stub = (app: string, developmentUiIssueCopy: boolean, role: string) =>
  createRoutesStub([
    {
      Component: () => (
        <DropdownMenu defaultOpen>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <IssueCopyMenuItem
              app={app}
              developmentUiIssueCopy={developmentUiIssueCopy}
              role={role}
            />
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      path: "/secret/:id",
    },
  ]);

describe("IssueCopyMenuItem", () => {
  let writeText: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  });

  afterEach(() => vi.unstubAllEnvs());

  it("is absent when the build flag is off, even with the server flag on", async () => {
    vi.stubEnv("SNEAKERS_DEV_UI_ISSUE_COPY_BUILD", "false");
    const Stub = stub("staff", true, "site-admin");
    render(<Stub initialEntries={["/secret/sec_01H"]} />);
    expect(await screen.findByText("Open")).toBeInTheDocument();
    expect(screen.queryByText("Copy for UI issue")).toBeNull();
  });

  it("is absent when the server flag is off, even with the build flag on", async () => {
    vi.stubEnv("SNEAKERS_DEV_UI_ISSUE_COPY_BUILD", "true");
    const Stub = stub("staff", false, "site-admin");
    render(<Stub initialEntries={["/secret/sec_01H"]} />);
    expect(await screen.findByText("Open")).toBeInTheDocument();
    expect(screen.queryByText("Copy for UI issue")).toBeNull();
  });

  it("renders only once both the build flag and the server flag are on", async () => {
    vi.stubEnv("SNEAKERS_DEV_UI_ISSUE_COPY_BUILD", "true");
    const Stub = stub("staff", true, "site-admin");
    render(<Stub initialEntries={["/secret/sec_01H"]} />);
    expect(await screen.findByText("Copy for UI issue")).toBeInTheDocument();
  });

  it("copies one line of schema v1 JSON built from the current route", async () => {
    vi.stubEnv("SNEAKERS_DEV_UI_ISSUE_COPY_BUILD", "true");
    const Stub = stub("staff", true, "site-admin");
    render(<Stub initialEntries={["/secret/0b6f3a52-6c1e-4f0a-9d2b-7e8f9a0b1c2d"]} />);
    await userEvent.click(await screen.findByText("Copy for UI issue"));
    expect(writeText).toHaveBeenCalledTimes(1);
    const line = writeText.mock.calls[0]?.[0] as string;
    expect(line.split("\n")).toHaveLength(1);
    const bundle = JSON.parse(line);
    expect(bundle).toMatchObject({
      app: "staff",
      params: { id: "0b6f3a52-6c1e-4f0a-9d2b-7e8f9a0b1c2d" },
      path: "/secret/:id",
      product: "sneakers",
      role: "site-admin",
      v: 1,
    });
    expect(Object.keys(bundle)[0]).toBe("v");
    expect(Object.keys(bundle)[1]).toBe("product");
  });

  it("carries the release-check marker on the mounted item", async () => {
    vi.stubEnv("SNEAKERS_DEV_UI_ISSUE_COPY_BUILD", "true");
    const Stub = stub("staff", true, "site-admin");
    render(<Stub initialEntries={["/secret/0b6f3a52-6c1e-4f0a-9d2b-7e8f9a0b1c2d"]} />);
    const item = await screen.findByRole("menuitem", { name: /Copy for UI issue/ });
    expect(ISSUE_COPY_MARKER).toMatch(/^sneakers-ui-issue-copy-/);
    expect(item).toHaveAttribute("data-issue-copy", ISSUE_COPY_MARKER);
  });
});
