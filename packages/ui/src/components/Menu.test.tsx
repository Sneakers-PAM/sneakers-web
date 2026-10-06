import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "#ui/components/Menu";

describe("DropdownMenu", () => {
  it("never locks the body's scroll, so opening it can't shift the page", async () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Item</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByText("Open"));
    await screen.findByText("Item");
    expect(document.body).not.toHaveAttribute("data-scroll-locked");
    expect(document.body.style.paddingRight).toBe("");
  });

  it("still closes on an outside click and on Escape", async () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Item</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByText("Open"));
    await screen.findByText("Item");
    await user.keyboard("{Escape}");
    expect(screen.queryByText("Item")).toBeNull();
  });
});
