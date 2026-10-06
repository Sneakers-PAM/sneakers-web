import { render, screen } from "@testing-library/react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#ui/components/Select";

describe("Select", () => {
  it("keeps a long value on one line, truncated, instead of wrapping inside the trigger", () => {
    render(
      <Select onValueChange={() => {}} value="long">
        <SelectTrigger aria-label="Pick one">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="long">A much longer option label than the box is wide</SelectItem>
        </SelectContent>
      </Select>,
    );
    expect(screen.getByTestId("select-value")).toHaveClass("truncate");
    expect(screen.getByText("A much longer option label than the box is wide")).toBeInTheDocument();
  });
});
