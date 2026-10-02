import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * The header search. "/" focuses it from anywhere outside a text field; Enter runs the
 * search through `onSearch`.
 */
export const HeaderSearch = ({
  onSearch,
  placeholder = "Search secrets and folders",
}: {
  onSearch: (query: string) => void;
  placeholder?: string;
}) => {
  const ref = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ["INPUT", "SELECT", "TEXTAREA"].includes(t.tagName))) return;
      e.preventDefault();
      ref.current?.focus();
    };
    globalThis.addEventListener("keydown", onKey);
    return () => globalThis.removeEventListener("keydown", onKey);
  }, []);
  return (
    <form
      className="flex h-10.5 items-center gap-2.5 rounded-md border-[1.5px] border-border-strong bg-bg px-3 focus-within:border-primary focus-within:ring-3 focus-within:ring-primary-soft"
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim()) onSearch(q.trim());
      }}
      role="search"
    >
      <Search aria-hidden className="size-4 text-muted" />
      <input
        aria-label="Search secrets and folders"
        className="h-full min-w-0 flex-1 bg-transparent text-body text-ink outline-none placeholder:text-muted"
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        ref={ref}
        value={q}
      />
      <kbd className="rounded-[6px] border border-border-strong px-1.5 py-1 font-mono text-[0.75rem] leading-none font-bold text-muted">
        /
      </kbd>
    </form>
  );
};
