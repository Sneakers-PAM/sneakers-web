import { Popover as PopoverPrimitive, Tooltip as TooltipPrimitive } from "radix-ui";

import { cn } from "#ui/lib/cn";

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;
export const PopoverClose = PopoverPrimitive.Close;

export const PopoverContent = ({
  align = "start",
  className,
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) => {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        className={cn(
          "z-(--z-dropdown) w-72 rounded-lg border border-border-strong bg-surface p-4 text-ink shadow-menu outline-none",
          className,
        )}
        sideOffset={sideOffset}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
};

export const TooltipProvider = TooltipPrimitive.Provider;

/** A tooltip on any element. Blocked actions use it to give the reason they are blocked. */
export const Tooltip = ({
  children,
  content,
  side = "top",
}: {
  children: React.ReactNode;
  content: React.ReactNode;
  side?: "bottom" | "left" | "right" | "top";
}) => {
  return (
    <TooltipPrimitive.Root delayDuration={250}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          className="z-(--z-toast) max-w-72 rounded-sm bg-ink px-2.5 py-2 text-small font-bold text-bg shadow-menu"
          side={side}
          sideOffset={6}
        >
          {content}
          <TooltipPrimitive.Arrow className="fill-ink" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
};
