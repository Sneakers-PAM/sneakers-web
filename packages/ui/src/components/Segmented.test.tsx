import { render, screen } from "@testing-library/react";

import { Segmented } from "#ui/components/Segmented";

describe("Segmented", () => {
  it("never breaks an option's label mid-word, and lets the row wrap instead", () => {
    render(
      <Segmented
        label="Approval for reveals"
        onChange={() => {}}
        options={[
          { label: "Off", value: "off" },
          { label: "Non-owners", value: "required" },
          { label: "Everyone", value: "always" },
        ]}
        value="required"
      />,
    );
    expect(screen.getByRole("radio", { name: "Non-owners" })).toHaveClass("whitespace-nowrap");
    expect(screen.getByRole("radiogroup", { name: "Approval for reveals" })).toHaveClass(
      "flex-wrap",
    );
  });
});
