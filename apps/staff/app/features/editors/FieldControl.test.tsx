import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

import type { FieldDefinition } from "@/features/editors/validate";

import { FieldControl } from "@/features/editors/FieldControl";

const field = (key: string, kind: FieldDefinition["kind"], label: string): FieldDefinition => ({
  defaultValue: null,
  key,
  kind,
  label,
  maxLength: null,
  options: null,
  pattern: null,
  policyEnforcement: null,
  policyId: null,
  required: null,
  rotates: null,
  sensitive: kind === "sensitive" ? true : null,
  superSensitive: null,
});

const Harness = ({ definition }: { definition: FieldDefinition }) => {
  const [value, setValue] = useState("");
  return (
    <FieldControl
      editing={false}
      field={definition}
      onChange={setValue}
      policies={[]}
      value={value}
    />
  );
};

describe("a template field", () => {
  it("formats a phone number as it's typed", async () => {
    const user = userEvent.setup();
    render(<Harness definition={field("phone", "text", "Phone")} />);
    await user.type(screen.getByRole("textbox", { name: "Phone" }), "5550100123");
    expect(screen.getByRole("textbox", { name: "Phone" })).toHaveValue("(555) 010-0123");
  });

  it("formats a masked card number too", async () => {
    const user = userEvent.setup();
    render(<Harness definition={field("number", "sensitive", "Card number")} />);
    await user.type(screen.getByLabelText("Card number"), "41111111");
    expect(screen.getByLabelText("Card number")).toHaveValue("4111 1111");
  });

  it("hints a highly sensitive password field, never the raw field name", () => {
    render(<Harness definition={{ ...field("pin", "password", "PIN"), superSensitive: true }} />);
    expect(screen.getByText(/^Highly sensitive:/)).toBeInTheDocument();
    expect(screen.queryByText(/^Super-sensitive:/)).toBeNull();
  });
});
