import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DisplayPanel } from "#ui/theme/DisplayPanel";

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

describe("DisplayPanel", () => {
  // These cases exercise the desktop popover; the phone drawer has its own test below.
  let restoreWidth: () => void;
  beforeEach(() => {
    restoreWidth = atWidth(1440);
  });
  afterEach(() => {
    restoreWidth();
  });

  it("has a visible label clearer than a bare glyph, and keeps the accessible name", () => {
    render(<DisplayPanel />);
    const trigger = screen.getByRole("button", { name: "Accessibility settings" });
    expect(trigger).toHaveTextContent("Display");
  });

  it("has a compact, icon-only minimize control with no visible label", () => {
    render(<DisplayPanel />);
    const minimize = screen.getByRole("button", { name: "Minimize display settings" });
    expect(minimize.textContent).toBe("");
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

  it("remembers being minimized across a remount", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<DisplayPanel />);
    await user.click(screen.getByRole("button", { name: "Minimize display settings" }));
    unmount();
    render(<DisplayPanel />);
    expect(
      await screen.findByRole("button", { name: "Show display settings" }),
    ).toBeInTheDocument();
  });

  it("forgets the minimized state once the 30-day memory has expired", () => {
    localStorage.setItem(
      "sneakers.display-panel-minimized",
      JSON.stringify({ expires: Date.now() - 1000, value: true }),
    );
    render(<DisplayPanel />);
    expect(screen.getByRole("button", { name: "Accessibility settings" })).toBeInTheDocument();
  });

  it("keys the remembered state off storagePrefix, so mock and live modes don't collide", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<DisplayPanel storagePrefix="mock:" />);
    await user.click(screen.getByRole("button", { name: "Minimize display settings" }));
    unmount();
    render(<DisplayPanel />);
    expect(screen.getByRole("button", { name: "Accessibility settings" })).toBeInTheDocument();
  });

  it("opens as a bottom drawer at phone widths, not a popover anchored to the trigger", async () => {
    const restore = atWidth(375);
    try {
      const user = userEvent.setup();
      render(<DisplayPanel />);
      await user.click(screen.getByRole("button", { name: "Accessibility settings" }));
      // the Sheet-based drawer renders a heading; the desktop popover's title is plain text
      expect(await screen.findByRole("heading", { name: "Display & motion" })).toBeInTheDocument();
    } finally {
      restore();
    }
  });
});
