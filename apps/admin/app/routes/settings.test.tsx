import { mockSettings } from "@sneakers-pam/mock-server/in-process";
import { withMockGateway } from "@sneakers-pam/mock-server/in-process/testing";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { MCP_TOOLS, withTool } from "@/lib/mcpTools";
import * as settings from "@/routes/settings";
import { renderAdmin } from "@/test/stub";

withMockGateway();

const ROUTES = [{ module: settings, path: "/settings" }];

const panel = () => within(screen.getByRole("region", { name: "MCP tools" }));
const tool = (name: string) => panel().getByRole("switch", { name });

describe("admin settings", () => {
  it("shows the security settings with their defaults and saves a switch", async () => {
    const user = userEvent.setup();
    renderAdmin(ROUTES, "/settings");
    const checkout = await screen.findByRole("switch", {
      name: /Require MFA for sensitive checkout/,
    });
    expect(checkout).toBeChecked();
    const api = screen.getByRole("switch", { name: "Allow API access to sensitive secrets" });
    expect(api).not.toBeChecked();
    expect(screen.getByRole("switch", { name: "Require MFA before a reveal" })).not.toBeChecked();
    expect(
      screen.getByText(/from 0 \(every time\)\s+to 4 hours, 30 minutes by default/),
    ).toBeInTheDocument();
    expect(screen.getByText("30 minutes")).toBeInTheDocument();
    expect(screen.queryByText("MFA_MAX_AGE", { selector: "span" })).not.toBeInTheDocument();
    await user.click(api);
    await vi.waitFor(() =>
      expect(
        screen.getByRole("switch", { name: "Allow API access to sensitive secrets" }),
      ).toBeChecked(),
    );
  });

  it("turns the top-level folder restriction on and off, starting off", async () => {
    const user = userEvent.setup();
    renderAdmin(ROUTES, "/settings");
    const name = "Restrict top-level folders to admins";
    const restrict = await screen.findByRole("switch", { name });
    expect(restrict).not.toBeChecked();
    expect(screen.getByText(/create a top-level folder/)).toBeInTheDocument();
    await user.click(restrict);
    await vi.waitFor(() => expect(screen.getByRole("switch", { name })).toBeChecked());
    expect(mockSettings.security.restrictTopLevelFolders).toBe(true);
    await user.click(screen.getByRole("switch", { name }));
    await vi.waitFor(() => expect(screen.getByRole("switch", { name })).not.toBeChecked());
    expect(mockSettings.security.restrictTopLevelFolders).toBe(false);
  });

  it("refuses a session timeout outside 15 to 60 minutes", async () => {
    const user = userEvent.setup();
    renderAdmin(ROUTES, "/settings");
    const timeout = await screen.findByLabelText("Session timeout (minutes)");
    await user.clear(timeout);
    await user.type(timeout, "75");
    expect(screen.getByText("Max is 60.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save limits" })).toBeDisabled();
  });

  describe("MCP tools", () => {
    it("lists every MCP tool with its own switch, all on by default", async () => {
      renderAdmin(ROUTES, "/settings");
      await screen.findByRole("region", { name: "MCP tools" });
      expect(panel().getAllByRole("switch")).toHaveLength(MCP_TOOLS.length);
      for (const { name } of MCP_TOOLS) expect(tool(name)).toBeChecked();
      expect(mockSettings.security.disabledMcpTools).toEqual([]);
    });

    it("switches one tool off and back on, leaving the others as they were", async () => {
      const user = userEvent.setup();
      renderAdmin(ROUTES, "/settings");
      await screen.findByRole("region", { name: "MCP tools" });
      await user.click(tool("sneakers_rotate_secret"));
      await vi.waitFor(() => expect(tool("sneakers_rotate_secret")).not.toBeChecked());
      expect(mockSettings.security.disabledMcpTools).toEqual(["sneakers_rotate_secret"]);
      await user.click(tool("sneakers_move_secret"));
      await vi.waitFor(() => expect(tool("sneakers_move_secret")).not.toBeChecked());
      expect(mockSettings.security.disabledMcpTools).toEqual([
        "sneakers_rotate_secret",
        "sneakers_move_secret",
      ]);
      await user.click(tool("sneakers_rotate_secret"));
      await vi.waitFor(() => expect(tool("sneakers_rotate_secret")).toBeChecked());
      expect(mockSettings.security.disabledMcpTools).toEqual(["sneakers_move_secret"]);
    });

    it("starts from what the box has now, not from what the page loaded", async () => {
      const user = userEvent.setup();
      renderAdmin(ROUTES, "/settings");
      await screen.findByRole("region", { name: "MCP tools" });
      // Another admin switches a tool off after this page loaded.
      mockSettings.security.disabledMcpTools = ["sneakers_get_secret"];
      await user.click(tool("sneakers_rotate_secret"));
      await vi.waitFor(() => expect(tool("sneakers_rotate_secret")).not.toBeChecked());
      expect(mockSettings.security.disabledMcpTools).toEqual([
        "sneakers_get_secret",
        "sneakers_rotate_secret",
      ]);
    });

    it("shows a tool already off, even one it doesn't know, so it can be switched back on", async () => {
      const user = userEvent.setup();
      mockSettings.security.disabledMcpTools = ["sneakers_future_tool"];
      renderAdmin(ROUTES, "/settings");
      await screen.findByRole("region", { name: "MCP tools" });
      expect(tool("sneakers_future_tool")).not.toBeChecked();
      await user.click(tool("sneakers_future_tool"));
      await vi.waitFor(() => expect(mockSettings.security.disabledMcpTools).toEqual([]));
    });

    it("turns every tool back on at once", async () => {
      const user = userEvent.setup();
      mockSettings.security.disabledMcpTools = ["sneakers_get_secret", "sneakers_move_secret"];
      renderAdmin(ROUTES, "/settings");
      await screen.findByRole("region", { name: "MCP tools" });
      await user.click(panel().getByRole("button", { name: "Turn every tool on" }));
      await vi.waitFor(() => expect(mockSettings.security.disabledMcpTools).toEqual([]));
      await vi.waitFor(() => expect(tool("sneakers_get_secret")).toBeChecked());
    });

    it("says what a switched-off tool means", async () => {
      renderAdmin(ROUTES, "/settings");
      await screen.findByRole("region", { name: "MCP tools" });
      expect(
        panel().getByText(/isn't offered to agents and is refused if called/),
      ).toBeInTheDocument();
    });
  });

  describe("withTool", () => {
    it("adds a tool once and removes it cleanly", () => {
      expect(withTool([], "a", false)).toEqual(["a"]);
      expect(withTool(["a"], "a", false)).toEqual(["a"]);
      expect(withTool(["a", "b"], "a", true)).toEqual(["b"]);
      expect(withTool(["b"], "a", true)).toEqual(["b"]);
    });
  });
});
