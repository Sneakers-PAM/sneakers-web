import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

import { CodeInput } from "#ui/components/CodeInput";

const Harness = ({ onComplete }: { onComplete: (v: string) => void }) => {
  const [v, setV] = useState("");
  return <CodeInput name="code" onChange={setV} onComplete={onComplete} value={v} />;
};

describe("CodeInput", () => {
  it("is one field that keeps digits only and fires onComplete at six", async () => {
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);
    const input = screen.getByLabelText("6-digit code");
    expect(input).toHaveAttribute("autocomplete", "one-time-code");
    expect(input).toHaveAttribute("name", "code");
    await userEvent.type(input, "48a1-02");
    expect(input).toHaveValue("48102");
    expect(onComplete).not.toHaveBeenCalled();
    await userEvent.type(input, "79");
    expect(input).toHaveValue("481027");
    expect(onComplete).toHaveBeenCalledWith("481027");
  });

  it("marks a wrong code invalid", () => {
    render(<CodeInput invalid onChange={() => {}} value="000000" />);
    expect(screen.getByLabelText("6-digit code")).toHaveAttribute("aria-invalid", "true");
  });

  it("takes an autoComplete override and passes password-manager ignore attributes through", () => {
    render(
      <CodeInput
        autoComplete="off"
        data-1p-ignore
        data-bwignore
        data-form-type="other"
        data-lpignore="true"
        onChange={() => {}}
        value=""
      />,
    );
    const input = screen.getByLabelText("6-digit code");
    expect(input).toHaveAttribute("autocomplete", "off");
    expect(input).toHaveAttribute("data-1p-ignore", "true");
    expect(input).toHaveAttribute("data-lpignore", "true");
    expect(input).toHaveAttribute("data-bwignore", "true");
    expect(input).toHaveAttribute("data-form-type", "other");
  });
});
