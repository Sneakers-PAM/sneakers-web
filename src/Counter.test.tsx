import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Counter } from "./Counter.js";

describe("Counter", () => {
  it("starts at zero and increments on click", async () => {
    const user = userEvent.setup();
    render(<Counter />);

    const button = screen.getByRole("button", { name: /count is 0/i });
    expect(button).toBeInTheDocument();

    await user.click(button);
    expect(screen.getByRole("button", { name: /count is 1/i })).toBeInTheDocument();
  });
});
