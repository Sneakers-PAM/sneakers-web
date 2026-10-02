import { render, screen } from "@testing-library/react";

import { Countdown, formatDuration } from "#ui/components/Countdown";

describe("Countdown", () => {
  it("formats seconds as h:mm:ss or m:ss", () => {
    expect(formatDuration(7146)).toBe("1:59:06");
    expect(formatDuration(246)).toBe("4:06");
    expect(formatDuration(-5)).toBe("0:00");
  });

  it("goes warn under ten minutes and solid danger under one", () => {
    const now = Date.now();
    const { rerender } = render(<Countdown until={now + 3_600_000} />);
    expect(screen.getByRole("timer")).toHaveClass("bg-sunken");
    rerender(<Countdown until={now + 300_000} />);
    expect(screen.getByRole("timer")).toHaveClass("bg-warn-soft");
    rerender(<Countdown until={now + 30_000} />);
    expect(screen.getByRole("timer")).toHaveClass("bg-danger");
  });

  it("uses the agent thresholds when asked (3 minutes and 1)", () => {
    render(<Countdown dangerBelow={60} until={Date.now() + 240_000} warnBelow={180} />);
    expect(screen.getByRole("timer")).toHaveClass("bg-sunken");
  });
});
