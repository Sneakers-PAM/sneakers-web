import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { LongValue } from "#ui/components/LongValue";

describe("LongValue", () => {
  it("wraps a 300-character unbroken value instead of letting it overflow", () => {
    const value = `SHA256:${"A".repeat(300)}`;
    render(<LongValue value={value} />);
    expect(screen.getByText(value)).toHaveClass("min-w-0", "flex-1", "wrap-anywhere");
  });

  it("keeps a multiline value's own line breaks while still wrapping anywhere", () => {
    const value = `ssh-ed25519 ${"B".repeat(300)} admin@example.org\nsecond line`;
    render(<LongValue multiline value={value} />);
    const node = screen.getByText(
      (_, element) => element?.tagName === "SPAN" && element.textContent === value,
    );
    expect(node).toHaveClass("whitespace-pre-wrap", "wrap-anywhere");
  });

  it("renders no Copy button when copyLabel is omitted", () => {
    render(<LongValue value="short" />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("copies the exact value, never a truncated or re-wrapped one", async () => {
    const value = `target-${"C".repeat(300)}`;
    render(<LongValue copyLabel="Fingerprint" value={value} />);
    const writeText = vi.fn().mockResolvedValue(null);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    await userEvent.click(screen.getByRole("button", { name: "Copy Fingerprint" }));
    expect(writeText).toHaveBeenCalledWith(value);
    expect(writeText).toHaveBeenCalledTimes(1);
  });
});
