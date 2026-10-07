import { Check } from "lucide-react";
import { ContextMenu as ContextPrimitive, DropdownMenu as MenuPrimitive } from "radix-ui";

import { cn } from "#ui/lib/cn";

const contentClasses =
  "z-(--z-dropdown) min-w-56 overflow-hidden rounded-lg border border-border-strong bg-surface p-1.5 text-ink shadow-menu";
const itemClasses =
  "relative flex cursor-pointer items-center gap-2.5 rounded-sm px-3 py-2.75 text-body outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:text-muted data-[highlighted]:bg-sunken [&_svg]:size-4 [&_svg]:shrink-0";

/**
 * Non-modal: Radix's modal default locks body scroll (`data-scroll-locked`), which compensates
 * for the vanished scrollbar with a margin that can visibly shift the page on a phone, where
 * there's no scrollbar to remove. A dropdown menu doesn't need the modal's focus trap either.
 */
export const DropdownMenu = (props: React.ComponentProps<typeof MenuPrimitive.Root>) => (
  <MenuPrimitive.Root modal={false} {...props} />
);
export const DropdownMenuTrigger = MenuPrimitive.Trigger;
export const DropdownMenuGroup = MenuPrimitive.Group;

export const DropdownMenuCheckboxItem = ({
  children,
  className,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.CheckboxItem>) => {
  return (
    <MenuPrimitive.CheckboxItem className={cn(itemClasses, "pl-9", className)} {...props}>
      <span className="absolute left-2.5 flex size-5 items-center justify-center rounded-[6px] border-[1.5px] border-control data-[state=checked]:bg-primary">
        <MenuPrimitive.ItemIndicator>
          <Check className="text-primary" strokeWidth={3} />
        </MenuPrimitive.ItemIndicator>
      </span>
      {children}
    </MenuPrimitive.CheckboxItem>
  );
};

export const DropdownMenuContent = ({
  align = "end",
  className,
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Content>) => {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Content
        align={align}
        className={cn(contentClasses, className)}
        sideOffset={sideOffset}
        {...props}
      />
    </MenuPrimitive.Portal>
  );
};

export const DropdownMenuItem = ({
  className,
  tone,
  ...props
}: { tone?: "danger" | "strong" } & React.ComponentProps<typeof MenuPrimitive.Item>) => {
  return (
    <MenuPrimitive.Item
      className={cn(
        itemClasses,
        tone === "danger" && "text-danger",
        tone === "strong" && "font-bold",
        className,
      )}
      {...props}
    />
  );
};

export const DropdownMenuLabel = ({
  className,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Label>) => {
  return (
    <MenuPrimitive.Label
      className={cn("mb-1 flex flex-col gap-1 border-b border-border p-3", className)}
      {...props}
    />
  );
};

export const DropdownMenuSeparator = ({
  className,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Separator>) => {
  return (
    <MenuPrimitive.Separator className={cn("mx-1.5 my-1 h-px bg-border", className)} {...props} />
  );
};

export const ContextMenu = ContextPrimitive.Root;
export const ContextMenuTrigger = ContextPrimitive.Trigger;

export const ContextMenuContent = ({
  className,
  ...props
}: React.ComponentProps<typeof ContextPrimitive.Content>) => {
  return (
    <ContextPrimitive.Portal>
      <ContextPrimitive.Content className={cn(contentClasses, className)} {...props} />
    </ContextPrimitive.Portal>
  );
};

export const ContextMenuItem = ({
  className,
  tone,
  ...props
}: { tone?: "danger" } & React.ComponentProps<typeof ContextPrimitive.Item>) => {
  return (
    <ContextPrimitive.Item
      className={cn(itemClasses, tone === "danger" && "text-danger", className)}
      {...props}
    />
  );
};

export const ContextMenuSeparator = ({
  className,
  ...props
}: React.ComponentProps<typeof ContextPrimitive.Separator>) => {
  return (
    <ContextPrimitive.Separator
      className={cn("mx-1.5 my-1 h-px bg-border", className)}
      {...props}
    />
  );
};
