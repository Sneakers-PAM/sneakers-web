import { Tabs as TabsPrimitive, ToggleGroup } from "radix-ui";

import { cn } from "#ui/lib/cn";

const listClasses = "flex gap-1 rounded-lg bg-sunken p-1";
const itemClasses =
  "flex-1 rounded-[9px] px-3.5 text-[0.875rem] font-bold text-ink transition-colors duration-[120ms] ease-laces hover:bg-surface/60 data-[state=active]:bg-surface data-[state=active]:shadow-seg data-[state=on]:bg-surface data-[state=on]:shadow-seg disabled:cursor-not-allowed disabled:text-muted";

export interface SegmentedOption<T extends string> {
  disabled?: boolean;
  label: React.ReactNode;
  value: T;
}

/**
 * A segmented control for picking one option (a filter, a factor, a view). It is a
 * single-select toggle group: each option is a pressed or unpressed button.
 */
export const Segmented = <T extends string>({
  className,
  label,
  onChange,
  options,
  size = "md",
  value,
}: {
  className?: string;
  label: string;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  size?: "md" | "sm";
  value: T;
}) => {
  return (
    <ToggleGroup.Root
      aria-label={label}
      className={cn(listClasses, size === "sm" && "rounded-md p-[3px]", className)}
      onValueChange={(v) => {
        if (v) onChange(v as T);
      }}
      type="single"
      value={value}
    >
      {options.map((o) => (
        <ToggleGroup.Item
          className={cn(itemClasses, size === "sm" ? "h-8.5 text-small" : "h-10")}
          disabled={o.disabled}
          key={o.value}
          value={o.value}
        >
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
};

export const Tabs = TabsPrimitive.Root;
export const TabsContent = TabsPrimitive.Content;

export const TabsList = ({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) => {
  return <TabsPrimitive.List className={cn(listClasses, className)} {...props} />;
};

export const TabsTrigger = ({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) => {
  return <TabsPrimitive.Trigger className={cn(itemClasses, "h-10", className)} {...props} />;
};
