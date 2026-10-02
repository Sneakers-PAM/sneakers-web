import { Check, Minus } from "lucide-react";
import { Checkbox as CheckboxPrimitive, Switch as SwitchPrimitive } from "radix-ui";

import { cn } from "#ui/lib/cn";

export const Checkbox = ({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) => {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        "peer inline-flex size-5 shrink-0 items-center justify-center rounded-[6px] border-[1.5px] border-control bg-surface text-on-primary transition-colors duration-[120ms] data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary disabled:cursor-not-allowed disabled:border-border disabled:bg-sunken",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center">
        {props.checked === "indeterminate" ? (
          <Minus className="size-3.5" strokeWidth={3} />
        ) : (
          <Check className="size-3.5" strokeWidth={3} />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
};

/** On/off switch. The knob shows a check when on, so state never relies on colour. */
export const Switch = ({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) => {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "group inline-flex h-7 w-12 shrink-0 items-center rounded-full border-[1.5px] border-control bg-sunken p-0.5 transition-colors duration-[200ms] ease-laces data-[state=checked]:border-primary data-[state=checked]:bg-primary disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="flex size-5.5 items-center justify-center rounded-full border-[1.5px] border-control bg-surface text-primary transition-transform duration-[200ms] ease-laces data-[state=checked]:translate-x-5 data-[state=checked]:border-surface">
        <Check className="hidden size-3 group-data-[state=checked]:block" strokeWidth={3.5} />
      </SwitchPrimitive.Thumb>
    </SwitchPrimitive.Root>
  );
};
