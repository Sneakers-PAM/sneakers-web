import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { mcp } from "@/lib/osadmin/client";
import { OsadminError } from "@/lib/osadmin/errors";
import { applyMockScenario } from "@/mock/edge.mock";
import Mcp from "@/routes/mcp";
import { renderPage } from "@/test/renderPage";

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
    await vi.waitFor(() => expect(screen.getAllByText("stopped")).toHaveLength(2));
  });

  it("sits under the installed product's name", async () => {
    renderPage(Mcp);
    await screen.findByRole("switch", { name: "MCP on" });
    expect(screen.getByText("Sneakers")).toBeInTheDocument();
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
