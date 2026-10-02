import { render, screen } from "@testing-library/react";

import { Field } from "#ui/components/Field";
import { Input } from "#ui/components/Input";

describe("Field", () => {
  it("labels the control and links its hint", () => {
    render(
      <Field hint="Default" label="Name">
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText("Name");
    expect(input).toHaveAccessibleDescription("Default");
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  it("marks the control invalid and reads the error instead of the hint", () => {
    render(
      <Field
        error="Enter a valid hostname, like db01.example.org"
        hint="Default"
        label="Hostname"
        required
      >
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText(/Hostname/);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-required", "true");
    expect(input).toHaveAccessibleDescription("Enter a valid hostname, like db01.example.org");
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid hostname");
  });
});
