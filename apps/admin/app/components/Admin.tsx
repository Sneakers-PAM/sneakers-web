import { refusalMessage } from "@sneakers-web/shell";
import {
  Button,
  Card,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from "@sneakers-web/ui";
import { Diamond, Info, Plus, X } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";

import type { ActionResult } from "@/lib/admin.server";

/** Toast each new action result once: the note when it worked, the reason when it didn't. */
export const useResultToast = (result: ActionResult | undefined): void => {
  const shown = useRef<ActionResult | undefined>(undefined);
  useEffect(() => {
    if (!result || shown.current === result) return;
    shown.current = result;
    if (result.ok) {
      if (result.done) toast(result.done);
    } else {
      toast.error(refusalMessage(result.refusal));
    }
  }, [result]);
};

/** A console card with its title inside, as the Laces admin frames draw them. */
export const Panel = ({
  aside,
  children,
  className,
  flush,
  title,
}: {
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  /** No inner padding below the title, for lists and tables that run edge to edge. */
  flush?: boolean;
  title?: ReactNode;
}) => (
  <Card className={cn("flex flex-col", !flush && "gap-4 p-5.5", className)}>
    {title && (
      <div className={cn("flex items-center gap-3", flush && "px-5.5 pt-5 pb-4")}>
        <h2 className="m-0 font-display text-[1.375rem] leading-[1.2] font-bold">{title}</h2>
        {aside && <div className="ml-auto flex items-center gap-2">{aside}</div>}
      </div>
    )}
    {children}
  </Card>
);

/** One setting: its name and what it does on the left, the control on the right. */
export const SettingRow = ({
  body,
  control,
  id,
  title,
}: {
  body: ReactNode;
  control: ReactNode;
  id?: string;
  title: ReactNode;
}) => (
  <div className="flex items-start gap-4 border-t border-border pt-4 first:border-t-0 first:pt-0">
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <b className="text-body" id={id}>
        {title}
      </b>
      <span className="text-small text-muted">{body}</span>
    </div>
    <div className="shrink-0">{control}</div>
  </div>
);

/** An inline "i" affordance that opens a short explanation next to a setting's title. */
export const InfoButton = ({ children, label }: { children: ReactNode; label: string }) => (
  <Popover>
    <PopoverTrigger asChild>
      <Button aria-label={label} size="icon-sm" variant="ghost">
        <Info aria-hidden />
      </Button>
    </PopoverTrigger>
    <PopoverContent className="flex flex-col gap-2 text-small leading-[1.45]">
      {children}
    </PopoverContent>
  </Popover>
);

/**
 * A one-of-many picker. With `name` it also posts with a form (Radix renders a hidden
 * native select), so it works in a plain <Form> as well as with a fetcher.
 */
export const Choice = <T extends string>({
  id,
  label,
  name,
  onChange,
  options,
  value,
}: {
  id?: string;
  label?: string;
  name?: string;
  onChange?: (value: T) => void;
  options: { label: string; value: T }[];
  value: T;
}) => (
  <Select name={name} onValueChange={(v) => onChange?.(v as T)} value={value}>
    <SelectTrigger aria-label={label} id={id}>
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      {options.map((o) => (
        <SelectItem key={o.value} value={o.value}>
          {o.label}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
);

/** Groups as removable chips, with "Add group" offering the ones not picked yet. */
export const GroupPicker = ({
  groups,
  label,
  onChange,
  value,
}: {
  groups: { id: string; name: string }[];
  label: string;
  onChange: (ids: string[]) => void;
  value: string[];
}) => {
  const name = (id: string) => groups.find((g) => g.id === id)?.name ?? id;
  const rest = groups.filter((g) => !value.includes(g.id));
  return (
    <div aria-label={label} className="flex flex-wrap items-center gap-2" role="group">
      {value.map((id) => (
        <span
          className="inline-flex h-8.5 items-center gap-1.5 rounded-sm bg-sunken pr-1 pl-2.5 text-[0.875rem] font-bold"
          key={id}
        >
          <Diamond aria-hidden className="size-3.5" />
          {name(id)}
          <button
            aria-label={`Remove ${name(id)}`}
            className="inline-flex size-6 items-center justify-center rounded-xs text-muted hover:bg-surface hover:text-danger"
            onClick={() => onChange(value.filter((v) => v !== id))}
            type="button"
          >
            <X aria-hidden className="size-3.5" />
          </button>
        </span>
      ))}
      {value.length === 0 && <span className="text-small text-muted">No groups.</span>}
      {rest.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center gap-1 text-small font-bold text-primary hover:text-ink">
            <Plus aria-hidden className="size-3.5" />
            Add group
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {rest.map((g) => (
              <DropdownMenuItem key={g.id} onSelect={() => onChange([...value, g.id])}>
                {g.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
};
