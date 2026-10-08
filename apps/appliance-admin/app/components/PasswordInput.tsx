import { Button, Input } from "@sneakers-web/ui";
import { Eye, EyeOff } from "lucide-react";
import { type InputHTMLAttributes, useState } from "react";

/**
 * A password field with a show/hide toggle. Paste is allowed: a password manager's paste is
 * the safest way in. Field wires the id and the aria attributes into the input.
 */
export const PasswordInput = ({
  autoComplete = "current-password",
  label = "the password",
  onChange,
  value,
  ...wiring
}: {
  autoComplete?: string;
  label?: string;
  onChange: (value: string) => void;
  value: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "type" | "value">) => {
  const [shown, setShown] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <Input
        {...wiring}
        autoComplete={autoComplete}
        className="flex-1"
        onChange={(event) => onChange(event.target.value)}
        type={shown ? "text" : "password"}
        value={value}
      />
      <Button
        aria-label={`${shown ? "Hide" : "Show"} ${label}`}
        aria-pressed={shown}
        onClick={() => setShown((s) => !s)}
        size="icon"
        type="button"
        variant="secondary"
      >
        {shown ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
      </Button>
    </div>
  );
};
