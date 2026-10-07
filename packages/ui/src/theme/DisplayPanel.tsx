import { Accessibility, Minus, X } from "lucide-react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { useState } from "react";

import { SheetContent, Sheet as SheetRoot, SheetTrigger } from "#ui/components/Dialog";
import { Segmented } from "#ui/components/Segmented";
import { useExpiringLocalValue, writeExpiringItem } from "#ui/lib/client";
import { cn } from "#ui/lib/cn";
import { useBreakpoint } from "#ui/lib/media";
import {
  type ContrastChoice,
  type MotionChoice,
  type TextScale,
  type ThemeChoice,
  useDisplay,
} from "#ui/theme/ThemeProvider";

/**
 * The floating display and motion settings. It starts labelled; "Minimize" collapses it to
 * a small icon-only dot that never disappears, and clicking the dot restores the label. The
 * minimized choice is remembered in this browser for 30 days. At phone widths the settings
 * open as a bottom drawer instead of a popover, so there's room to use them.
 */
export const DisplayPanel = ({
  className,
  storagePrefix = "",
}: {
  className?: string;
  storagePrefix?: string;
}) => {
  const { settings, update } = useDisplay();
  const phone = useBreakpoint() === "phone";
  const minimizedKey = `${storagePrefix}sneakers.display-panel-minimized`;
  const [writes, setWrites] = useState(0);
  // Null on the server and before hydration, so the first paint always renders expanded; the
  // saved choice (if any, and not yet expired) takes over right after.
  const minimized = useExpiringLocalValue<boolean>(minimizedKey, writes) === true;

  const setMinimized = (next: boolean) => {
    writeExpiringItem(minimizedKey, next);
    setWrites((n) => n + 1);
  };

  if (minimized) {
    return (
      <button
        aria-label="Show display settings"
        className={cn(
          "z-(--z-a11y) inline-flex size-10 items-center justify-center rounded-full border-[1.5px] border-border-strong bg-surface text-ink shadow-menu hover:bg-sunken",
          className,
        )}
        onClick={() => setMinimized(false)}
        type="button"
      >
        <Accessibility aria-hidden className="size-4.5" />
      </button>
    );
  }

  const rows = (
    <>
      <Row label="Text size">
        <Segmented<string>
          label="Text size"
          onChange={(v) => update({ textScale: Number(v) as TextScale })}
          options={[
            { label: "100%", value: "1" },
            { label: "125%", value: "1.25" },
            { label: "150%", value: "1.5" },
            { label: "200%", value: "2" },
          ]}
          size="sm"
          value={String(settings.textScale)}
        />
      </Row>
      <Row label="Contrast">
        <Segmented<ContrastChoice>
          label="Contrast"
          onChange={(contrast) => update({ contrast })}
          options={[
            { label: "Standard", value: "standard" },
            { label: "High", value: "high" },
          ]}
          size="sm"
          value={settings.contrast}
        />
      </Row>
      <Row label="Motion">
        <Segmented<MotionChoice>
          label="Motion"
          onChange={(motion) => update({ motion })}
          options={[
            { label: "System", value: "system" },
            { label: "Reduce", value: "reduce" },
          ]}
          size="sm"
          value={settings.motion}
        />
      </Row>
      <Row label="Theme">
        <Segmented<ThemeChoice>
          label="Theme"
          onChange={(theme) => update({ theme })}
          options={[
            { label: "System", value: "system" },
            { label: "Light", value: "light" },
            { label: "Dark", value: "dark" },
          ]}
          size="sm"
          value={settings.theme}
        />
      </Row>
      <span className="text-[0.75rem] leading-[1.45] text-muted">
        Saved to this browser. &ldquo;System&rdquo; follows your device settings.
      </span>
    </>
  );

  if (phone) {
    return (
      <div className={cn("z-(--z-a11y) flex items-center gap-1", className)}>
        <SheetRoot>
          <SheetTrigger
            aria-label="Accessibility settings"
            className="inline-flex h-11 items-center gap-2 rounded-full border-[1.5px] border-border-strong bg-surface px-4 text-[0.9375rem] font-bold text-ink shadow-menu hover:bg-sunken"
          >
            <Accessibility aria-hidden className="size-5" />
            Display
          </SheetTrigger>
          <SheetContent side="bottom" title="Display & motion">
            <div className="flex flex-col gap-4 overflow-y-auto px-5.5 py-5">{rows}</div>
          </SheetContent>
        </SheetRoot>
        <MinimizeButton onClick={() => setMinimized(true)} />
      </div>
    );
  }

  return (
    <div className={cn("z-(--z-a11y) flex items-center gap-1", className)}>
      <PopoverPrimitive.Root>
        <PopoverPrimitive.Trigger
          aria-label="Accessibility settings"
          className="inline-flex h-11 items-center gap-2 rounded-full border-[1.5px] border-border-strong bg-surface px-4 text-[0.9375rem] font-bold text-ink shadow-menu hover:bg-sunken"
        >
          <Accessibility aria-hidden className="size-5" />
          Display
        </PopoverPrimitive.Trigger>
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            align="start"
            aria-label="Accessibility"
            className="z-(--z-a11y) flex w-85 flex-col gap-4 rounded-xl border border-border-strong bg-surface p-5 text-ink shadow-dialog"
            side="top"
            sideOffset={12}
          >
            <div className="flex items-center">
              <b className="font-display text-[1.125rem] leading-none font-bold">
                Display &amp; motion
              </b>
              <PopoverPrimitive.Close
                aria-label="Close"
                className="ml-auto inline-flex size-8 items-center justify-center rounded-sm text-muted hover:bg-sunken"
              >
                <X aria-hidden className="size-4.5" />
              </PopoverPrimitive.Close>
            </div>
            {rows}
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
      <MinimizeButton onClick={() => setMinimized(true)} />
    </div>
  );
};

/** The minimize control: an icon plus a short visible label, not just an icon-only hit target. */
const MinimizeButton = ({ onClick }: { onClick: () => void }) => {
  return (
    <button
      aria-label="Minimize display settings"
      className="inline-flex h-11 items-center gap-1.5 rounded-full px-3 text-[0.8125rem] font-semibold text-muted hover:bg-sunken hover:text-ink"
      onClick={onClick}
      type="button"
    >
      <Minus aria-hidden className="size-3.5" />
      Minimize
    </button>
  );
};

const Row = ({ children, label }: { children: React.ReactNode; label: string }) => {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[0.875rem] leading-none font-bold">{label}</span>
      {children}
    </div>
  );
};
