import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DisplayPanel } from "#ui/theme/DisplayPanel";

describe("DisplayPanel", () => {
  it("has a visible label clearer than a bare glyph, and keeps the accessible name", () => {
    render(<DisplayPanel />);
    const trigger = screen.getByRole("button", { name: "Accessibility settings" });
    expect(trigger).toHaveTextContent("Display");
  });

  it("minimizes to a small icon-only dot that still opens the settings, never hiding the feature", async () => {
    const user = userEvent.setup();
    render(<DisplayPanel />);
    await user.click(screen.getByRole("button", { name: "Minimize display settings" }));
    expect(screen.queryByRole("button", { name: "Accessibility settings" })).toBeNull();
    const dot = screen.getByRole("button", { name: "Show display settings" });
    expect(dot).toBeInTheDocument();
    await user.click(dot);
    expect(screen.getByRole("button", { name: "Accessibility settings" })).toHaveTextContent(
      "Display",
    );
  });

  it("opens the display and motion settings from the trigger", async () => {
    const user = userEvent.setup();
    render(<DisplayPanel />);
    await user.click(screen.getByRole("button", { name: "Accessibility settings" }));
    expect(await screen.findByText("Display & motion")).toBeInTheDocument();
  });
});
