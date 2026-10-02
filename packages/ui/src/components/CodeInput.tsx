import { forwardRef, useImperativeHandle, useRef, useState } from "react";

import { cn } from "#ui/lib/cn";

export interface CodeInputProps {
  "aria-describedby"?: string;
  disabled?: boolean;
  id?: string;
  invalid?: boolean;
  label?: string;
  length?: number;
  /** The form field name, so the code posts with the form. */
  name?: string;
  onChange: (value: string) => void;
  /** Called when the sixth digit is typed. */
  onComplete?: (value: string) => void;
  size?: "lg" | "md";
  value: string;
}

/**
 * The six-digit code input. One real input sits over six display boxes, so paste, the
 * phone's one-time-code autofill and screen readers all see a single field.
 */
export const CodeInput = forwardRef<HTMLInputElement, CodeInputProps>(function CodeInput(
  {
    "aria-describedby": describedBy,
    disabled,
    id,
    invalid,
    label = "6-digit code",
    length = 6,
    name,
    onChange,
    onComplete,
    size = "lg",
    value,
  },
  ref,
) {
  const inner = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => inner.current as HTMLInputElement);
  const [focused, setFocused] = useState(false);
  const digits = Array.from({ length }, (_, index) => value[index] ?? "");
  return (
    <div className="relative flex gap-2">
      {digits.map((d, index) => {
        const current = focused && !invalid && index === Math.min(value.length, length - 1);
        return (
          <span
            aria-hidden
            className={cn(
              "flex flex-1 items-center justify-center rounded-md border-[1.5px] border-control bg-surface font-mono font-medium",
              size === "lg" ? "h-15 text-[1.625rem]" : "h-14 text-[1.5rem]",
              current && "border-2 border-primary ring-3 ring-primary-soft",
              invalid && "border-2 border-danger bg-danger-soft",
              disabled && "bg-sunken text-muted",
            )}
            key={index}
          >
            {d}
          </span>
        );
      })}
      <input
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        aria-label={label}
        autoComplete="one-time-code"
        className="absolute inset-0 cursor-text text-base opacity-0"
        disabled={disabled}
        id={id}
        inputMode="numeric"
        maxLength={length}
        name={name}
        onBlur={() => setFocused(false)}
        onChange={(event) => {
          const next = event.target.value.replaceAll(/\D/g, "").slice(0, length);
          onChange(next);
          if (next.length === length) onComplete?.(next);
        }}
        onFocus={() => setFocused(true)}
        ref={inner}
        value={value}
      />
    </div>
  );
});
