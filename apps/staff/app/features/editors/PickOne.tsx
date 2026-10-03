import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@sneakers-web/ui";
import { type ReactNode } from "react";

export interface PickOption {
  label: ReactNode;
  value: string;
}

/**
 * A kit Select that takes the id and aria wiring a `Field` hands its control, and puts it on
 * the trigger, so the label names the dropdown.
 */
export const PickOne = ({
  contentClassName,
  disabled,
  onChange,
  options,
  placeholder,
  value,
  ...wiring
}: {
  contentClassName?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  options: PickOption[];
  placeholder?: string;
  value: string;
} & Partial<Record<"id" | `aria-${string}`, unknown>>) => (
  <Select disabled={disabled} onValueChange={onChange} value={value || undefined}>
    <SelectTrigger {...(wiring as object)}>
      <SelectValue placeholder={placeholder} />
    </SelectTrigger>
    <SelectContent className={contentClassName}>
      {options.map((o) => (
        <SelectItem key={o.value} value={o.value}>
          {o.label}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
);
