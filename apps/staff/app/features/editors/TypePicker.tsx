import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@sneakers-web/ui";
import { useId } from "react";

import type { SecretType } from "@/features/editors/validate";

const ORIGINS = [
  { label: "System", origin: "system" },
  { label: "Extensions", origin: "extension" },
  { label: "Custom", origin: "custom" },
] as const;

const Group = ({ label, types }: { label: string; types: SecretType[] }) => {
  const id = useId();
  if (types.length === 0) return null;
  return (
    <SelectGroup aria-labelledby={id}>
      <div
        className="px-3 pt-2.5 pb-1 font-mono text-small font-bold tracking-[0.08em] text-muted uppercase"
        id={id}
      >
        {label}
      </div>
      {types.map((t) => (
        <SelectItem key={t.id} value={t.id}>
          {t.name}
          {t.vendor && <span className="text-muted"> · {t.vendor}</span>}
        </SelectItem>
      ))}
    </SelectGroup>
  );
};

/** Every type the vault has, grouped by where it comes from: system, extension packs, custom. */
export const TypePicker = ({
  disabled,
  id,
  invalid,
  onChange,
  types,
  value,
}: {
  disabled?: boolean;
  id?: string;
  invalid?: boolean;
  onChange: (typeId: string) => void;
  types: SecretType[];
  value: string;
}) => (
  <Select disabled={disabled} onValueChange={onChange} value={value || undefined}>
    <SelectTrigger aria-invalid={invalid || undefined} id={id}>
      <SelectValue placeholder="Pick a type" />
    </SelectTrigger>
    <SelectContent>
      {ORIGINS.map((o) => (
        <Group
          key={o.origin}
          label={o.label}
          types={types
            .filter((t) => t.origin === o.origin)
            .toSorted((a, b) => a.name.localeCompare(b.name))}
        />
      ))}
    </SelectContent>
  </Select>
);
