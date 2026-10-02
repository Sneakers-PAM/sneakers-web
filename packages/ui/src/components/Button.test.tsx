import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Button } from "#ui/components/Button";

describe("Button", () => {
  it("is a plain button by default, so it never submits a form by accident", () => {
    render(<Button>Check out</Button>);
    expect(screen.getByRole("button", { name: "Check out" })).toHaveAttribute("type", "button");
  });

  it("shows the loading label and ignores clicks while loading", async () => {
    const onClick = vi.fn();
    render(
      <Button loading loadingLabel="Checking out…" onClick={onClick}>
        Check out
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Checking out…" });
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(button, { pointerEventsCheck: 0 });
    expect(onClick).not.toHaveBeenCalled();
  });

  it("renders its child with the button styles when asChild is set", () => {
    render(
      <Button asChild variant="secondary">
        <a href="/x">Open</a>
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Open" });
    expect(link.className).toContain("border-border-strong");
  });
});
