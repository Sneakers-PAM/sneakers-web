import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

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

  it("turns MCP off", async () => {
    const user = userEvent.setup();
    renderPage(Mcp);
    await screen.findAllByText("MCP");
    await user.click(screen.getByRole("switch", { name: "MCP on" }));
    await vi.waitFor(() => expect(screen.getAllByText("stopped")).toHaveLength(2));
  });
});
