import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DisplayPanel } from "#ui/theme/DisplayPanel";
import {
  DEFAULT_DISPLAY,
  displayClassName,
  parseDisplay,
  TEXT_SIZES,
  textScaleFactor,
  ThemeProvider,
} from "#ui/theme/ThemeProvider";

describe("display settings", () => {
  it("parses saved settings and drops anything malformed", () => {
    expect(
      parseDisplay(
        JSON.stringify({ contrast: "high", motion: "reduce", textScale: "large", theme: "dark" }),
      ),
    ).toEqual({ contrast: "high", motion: "reduce", textScale: "large", theme: "dark" });
    expect(parseDisplay(JSON.stringify({ textScale: 9, theme: "neon" }))).toEqual(DEFAULT_DISPLAY);
    expect(parseDisplay("{nope")).toEqual(DEFAULT_DISPLAY);
    expect(parseDisplay(null)).toEqual(DEFAULT_DISPLAY);
  });

  it.each([
    [1, "normal"],
    [1.25, "large"],
    [1.5, "x-large"],
    [2, "x-large"],
  ])("moves a saved %s to a named step", (saved, step) => {
    expect(parseDisplay(JSON.stringify({ textScale: saved })).textScale).toBe(step);
  });

  it("offers five text sizes around an unchanged normal", () => {
    expect(TEXT_SIZES.map((s) => s.value)).toEqual([
      "x-small",
      "small",
      "normal",
      "large",
      "x-large",
    ]);
    expect(DEFAULT_DISPLAY.textScale).toBe("normal");
    expect(textScaleFactor("normal")).toBe(1);
  });

  it("maps settings to the <html> classes; high contrast wins over the theme", () => {
    expect(displayClassName(DEFAULT_DISPLAY)).toBe("system");
    expect(displayClassName({ ...DEFAULT_DISPLAY, theme: "light" })).toBe("");
    expect(displayClassName({ ...DEFAULT_DISPLAY, theme: "dark" })).toBe("dark");
    expect(displayClassName({ ...DEFAULT_DISPLAY, contrast: "high", theme: "dark" })).toBe("hc");
    expect(displayClassName({ ...DEFAULT_DISPLAY, motion: "reduce", theme: "light" })).toBe(
      "reduce-motion",
    );
  });

  it("switches theme and text size at once and reports the change for saving", async () => {
    const onChange = vi.fn();
    render(
      <ThemeProvider initial={DEFAULT_DISPLAY} onChange={onChange}>
        <DisplayPanel />
      </ThemeProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Accessibility settings" }));
    await userEvent.click(screen.getByRole("radio", { name: "Dark" }));
    expect(document.documentElement).toHaveClass("dark");
    await userEvent.click(screen.getByRole("radio", { name: "X-large" }));
    expect(document.documentElement.style.getPropertyValue("--text-scale")).toBe(
      String(textScaleFactor("x-large")),
    );
    await userEvent.click(screen.getByRole("radio", { name: "High" }));
    expect(document.documentElement).toHaveClass("hc");
    expect(document.documentElement).not.toHaveClass("dark");
    expect(onChange).toHaveBeenLastCalledWith({
      contrast: "high",
      motion: "system",
      textScale: "x-large",
      theme: "dark",
    });
  });
});
