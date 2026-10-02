import { Command as CommandPrimitive } from "cmdk";
import { Search } from "lucide-react";

import { cn } from "#ui/lib/cn";

/** Searchable list (the folder picker and people search are built on it). */
export const Command = ({ className, ...props }: React.ComponentProps<typeof CommandPrimitive>) => {
  return (
    <CommandPrimitive
      className={cn(
        "flex flex-col overflow-hidden rounded-md border-[1.5px] border-primary bg-surface text-ink",
        className,
      )}
      {...props}
    />
  );
};

export const CommandEmpty = (props: React.ComponentProps<typeof CommandPrimitive.Empty>) => {
  return <CommandPrimitive.Empty className="px-3.5 py-3 text-small text-muted" {...props} />;
};

export const CommandInput = ({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Input>) => {
  return (
    <div className="flex items-center gap-2 border-b border-border px-3.5">
      <Search aria-hidden className="size-4 text-muted" />
      <CommandPrimitive.Input
        className={cn(
          "h-11 w-full bg-transparent text-body outline-none placeholder:text-muted",
          className,
        )}
        {...props}
      />
    </div>
  );
};

export const CommandItem = ({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Item>) => {
  return (
    <CommandPrimitive.Item
      className={cn(
        "flex cursor-pointer items-center gap-2.5 px-3.5 py-2.75 text-body outline-none data-[disabled=true]:text-muted data-[selected=true]:bg-primary-soft",
        className,
      )}
      {...props}
    />
  );
};

export const CommandList = ({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.List>) => {
  return <CommandPrimitive.List className={cn("max-h-72 overflow-y-auto", className)} {...props} />;
};

export const CommandGroup = CommandPrimitive.Group;
