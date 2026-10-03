import {
  Button,
  type ButtonProps,
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@sneakers-web/ui";
import { Globe, Plus, User, Users } from "lucide-react";
import { useEffect, useState } from "react";

import type { RulesetSubject } from "#shell/sharing/types";

import { sameSubject } from "#shell/sharing/draft";

const MIN_QUERY = 2;

const ICON = { everyone: Globe, group: Users, user: User };
const META = { everyone: "Anyone who can sign in", group: "Group", user: "Person" };

/**
 * A button that opens a search over people and groups: the options the app gave, filtered by the
 * query, plus whatever its `search` answers once two letters are typed.
 */
export const SubjectPicker = ({
  exclude,
  label,
  onPick,
  options,
  placeholder = "Search people and groups",
  search,
  variant = "secondary",
}: {
  exclude: RulesetSubject[];
  label: string;
  onPick: (subject: RulesetSubject) => void;
  options: RulesetSubject[];
  placeholder?: string;
  search?: (query: string) => Promise<RulesetSubject[]>;
  variant?: ButtonProps["variant"];
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<RulesetSubject[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (!search || q.length < MIN_QUERY) return;
    let live = true;
    const timer = setTimeout(() => {
      setSearching(true);
      search(q)
        .then((r) => {
          if (live) setFound(r);
        })
        .catch(() => {
          if (live) setFound([]);
        })
        .finally(() => {
          if (live) setSearching(false);
        });
    }, 150);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query, search]);

  const q = query.trim().toLowerCase();
  const pool = [...options];
  if (search && q.length >= MIN_QUERY) {
    for (const f of found) if (!pool.some((p) => sameSubject(p, f))) pool.push(f);
  }
  const shown = pool
    .filter((o) => !exclude.some((x) => sameSubject(x, o)))
    .filter((o) => !q || o.name.toLowerCase().includes(q))
    .slice(0, 8);

  const close = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setQuery("");
      setFound([]);
    }
  };

  return (
    <Popover onOpenChange={close} open={open}>
      <PopoverTrigger asChild>
        <Button size="sm" variant={variant}>
          <Plus aria-hidden />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0">
        <Command shouldFilter={false}>
          <CommandInput onValueChange={setQuery} placeholder={placeholder} value={query} />
          <CommandList>
            <CommandEmpty>
              {searching
                ? "Searching..."
                : search && q.length > 0 && q.length < MIN_QUERY
                  ? "Type 2 or more letters"
                  : "No people or groups match"}
            </CommandEmpty>
            {shown.map((o) => {
              const Icon = ICON[o.kind];
              return (
                <CommandItem
                  key={`${o.kind}:${o.id ?? ""}`}
                  onSelect={() => {
                    onPick(o);
                    close(false);
                  }}
                  value={`${o.kind}:${o.id ?? ""}`}
                >
                  <Icon aria-hidden className="size-4 text-muted" />
                  <b className="font-bold">{o.name}</b>
                  <span className="text-small text-muted">{META[o.kind]}</span>
                </CommandItem>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
