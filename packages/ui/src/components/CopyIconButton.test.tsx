import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CopyIconButton } from "#ui/components/CopyIconButton";
import { Toaster } from "#ui/components/Toast";

describe("CopyIconButton", () => {
  it("copies the exact value and confirms it", async () => {
    render(
      <>
        <CopyIconButton label="Copy the file name" value="sneakers-1.2.3.bundle" />
        <Toaster />
      </>,
    );
    const writeText = vi.fn().mockResolvedValue(null);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    await userEvent.click(screen.getByRole("button", { name: "Copy the file name" }));
    expect(writeText).toHaveBeenCalledWith("sneakers-1.2.3.bundle");
    expect(await screen.findByText("Copied.")).toBeInTheDocument();
  });
});
