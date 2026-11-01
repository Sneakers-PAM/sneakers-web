/* eslint-disable testing-library/no-node-access -- the stack's position is only on the toaster list's data attributes, which have no accessible role to query. */
import { act, render, screen } from "@testing-library/react";

import { toast, Toaster } from "#ui/components/Toast";

const toaster = () => {
  const list = document.querySelector("[data-sonner-toaster]");
  if (!list) throw new Error("no toaster");
  return list;
};

describe("the toaster", () => {
  afterEach(() => act(() => void toast.dismiss()));

  it("sits bottom centre by default", async () => {
    render(<Toaster />);
    act(() => void toast("Saved."));
    await screen.findByText("Saved.");
    expect(toaster()).toHaveAttribute("data-x-position", "center");
    expect(toaster()).toHaveAttribute("data-y-position", "bottom");
  });

  it("stays above the Display button at desktop and phone width", async () => {
    render(<Toaster />);
    act(() => void toast("Lifted."));
    await screen.findByText("Lifted.");
    const { style } = toaster() as HTMLElement;
    expect(style.getPropertyValue("--offset-bottom")).toBe("4rem");
    expect(style.getPropertyValue("--mobile-offset-bottom")).toBe("4rem");
  });

  it("takes another position, such as top right", async () => {
    render(<Toaster position="top-right" />);
    act(() => void toast("Moved."));
    await screen.findByText("Moved.");
    expect(toaster()).toHaveAttribute("data-x-position", "right");
    expect(toaster()).toHaveAttribute("data-y-position", "top");
  });
});
