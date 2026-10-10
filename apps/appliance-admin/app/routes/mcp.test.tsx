import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { StepUpDialog } from "@/components/StepUpDialog";
import { mcp } from "@/lib/osadmin/client";
import { OsadminError } from "@/lib/osadmin/errors";
import { applyMockScenario } from "@/mock/edge.mock";
import Mcp, { MCP_POLL_MS } from "@/routes/mcp";
import { renderPage } from "@/test/renderPage";
import { signInAs } from "@/test/session";

describe("Mcp", () => {
  it("shows MCP on and the machine API off", async () => {
    renderPage(Mcp);
    const headings = await screen.findAllByText("MCP");
    expect(headings.length).toBeGreaterThan(0);
    expect(screen.getByRole("switch", { name: "MCP on" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "Machine API on" })).not.toBeChecked();
  });

  it("says it isn't available when the box's MCP backend isn't there", async () => {
    vi.spyOn(mcp, "get").mockRejectedValueOnce(
      new OsadminError("unimplemented", "McpService isn't on this box"),
    );
    renderPage(Mcp);
    expect(await screen.findByText("MCP: not available in this release")).toBeInTheDocument();
  });

  it("turns MCP off", async () => {
    const user = userEvent.setup();
    renderPage(Mcp);
    await screen.findAllByText("MCP");
    await user.click(screen.getByRole("switch", { name: "MCP on" }));
    await vi.waitFor(() => expect(screen.getByText(/MCP is off/)).toBeInTheDocument());
    expect(screen.getByRole("switch", { name: "MCP on" })).not.toBeChecked();
  });

  it("says in words what the box's MCP state means", async () => {
    renderPage(Mcp);
    expect(await screen.findByText(/MCP is on: agents can reach/)).toBeInTheDocument();
  });

  it("has no switch when the product has no MCP server", async () => {
    applyMockScenario("mcp-absent");
    renderPage(Mcp);
    expect(await screen.findByText(/Sneakers has no MCP server/)).toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  it("has no switch when the box can't find the product's switches", async () => {
    vi.spyOn(mcp, "get").mockResolvedValue({
      machineApiEnabled: true,
      mcpEnabled: false,
      state: "not installed",
    });
    renderPage(Mcp);
    expect(await screen.findByText(/MCP isn't installed on this box/)).toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  it("asks for a fresh code before it switches MCP", async () => {
    signInAs("alice");
    applyMockScenario("stepup");
    const user = userEvent.setup();
    renderPage(() => (
      <>
        <Mcp />
        <StepUpDialog />
      </>
    ));
    await user.click(await screen.findByRole("switch", { name: "MCP on" }));
    const dialog = within(await screen.findByRole("dialog"));
    await user.type(dialog.getByLabelText("Authenticator code"), "123456");
    await user.click(dialog.getByRole("button", { name: "Verify code" }));
    await vi.waitFor(() => expect(screen.getByText(/MCP is off/)).toBeInTheDocument());
  });

  it("sits under the installed product's name", async () => {
    renderPage(Mcp);
    await screen.findByRole("switch", { name: "MCP on" });
    expect(screen.getByText("Sneakers")).toBeInTheDocument();
  });

  it("follows a switch made elsewhere (the closed shell) while it's open", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const get = vi.spyOn(mcp, "get").mockResolvedValue({
        machineApiEnabled: true,
        mcpEnabled: false,
        state: "off",
      });
      renderPage(Mcp);
      expect(await screen.findByText(/MCP is off/)).toBeInTheDocument();
      get.mockResolvedValue({ machineApiEnabled: true, mcpEnabled: true, state: "on" });
      await vi.advanceTimersByTimeAsync(MCP_POLL_MS);
      expect(await screen.findByText(/MCP is on: agents can reach/)).toBeInTheDocument();
      expect(screen.getByRole("switch", { name: "MCP on" })).toBeChecked();
    } finally {
      vi.useRealTimers();
    }
  });

  it("has nothing to show, and doesn't name MCP, with no product installed", async () => {
    applyMockScenario("no-product");
    const get = vi.spyOn(mcp, "get");
    renderPage(Mcp);
    expect(await screen.findByText("Nothing here")).toBeInTheDocument();
    expect(screen.queryByText(/mcp/i)).not.toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
  });
});
