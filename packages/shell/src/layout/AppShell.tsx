import { Brand, cn, DisplayPanel, useBreakpoint, useMediaQuery } from "@sneakers-web/ui";
import { Menu, X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { type ReactNode, useState } from "react";
import { Link, useLocation } from "react-router";

import { EnvironmentBadge } from "#shell/gate/Frames";
import { EdgeBanner } from "#shell/layout/EdgeBanner";
import { useRootData } from "#shell/root/useRootData";

export interface AppShellProps {
  account: ReactNode;
  /** Header buttons on the right, before the account menu. */
  actions?: ReactNode;
  /** Full-width notices under the header (the MFA nudge). */
  banners?: ReactNode;
  children: ReactNode;
  home: string;
  /** Text after the wordmark in the admin header. */
  label?: ReactNode;
  search?: ReactNode;
  /** The sidebar. Gets `collapsed` when the sidebar is an icon rail. */
  sidebar: (collapsed: boolean) => ReactNode;
  /** "admin" inverts the header so the console is never mistaken for the user app. */
  variant?: "admin" | "staff";
}

/**
 * The app frame: header, optional banners, the sidebar (full, an icon rail, or a drawer on
 * phones) and the main column, plus the floating display-settings button.
 */
export const AppShell = ({
  account,
  actions,
  banners,
  children,
  home,
  label,
  search,
  sidebar,
  variant = "staff",
}: AppShellProps) => {
  const { storagePrefix } = useRootData();
  const bp = useBreakpoint();
  // A fixed rail needs real desktop width: an iPad Pro 13 (1024 or 1366 wide) still reads as
  // "desktop" from useBreakpoint, but has no room for a permanent sidebar next to the content.
  const wide = useMediaQuery("(min-width: 1440px)");
  const { pathname } = useLocation();
  // A sidebar toggle holds for the breakpoint it was made at; the drawer for the page it
  // was opened on, so it closes itself after a navigation.
  const [toggle, setToggle] = useState<{ at: string; expanded: boolean } | null>(null);
  const [drawerOn, setDrawerOn] = useState<null | string>(null);
  const expanded = toggle?.at === bp ? toggle.expanded : bp === "desktop";
  const setExpanded = (next: (v: boolean) => boolean) =>
    setToggle({ at: bp, expanded: next(expanded) });
  const drawer = drawerOn === pathname;
  const setDrawer = (open: boolean) => setDrawerOn(open ? pathname : null);
  const admin = variant === "admin";
  const phone = bp === "phone";
  // Below the wide threshold, the sidebar is a drawer (same as on a phone), not a fixed rail.
  const narrow = !wide;
  const railOpen = expanded && !narrow;

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-bg text-ink">
      <EdgeBanner />
      <header
        className={cn(
          "relative z-(--z-header) flex h-16 flex-none items-center gap-2 px-3 tablet:gap-3.5 tablet:px-5",
          admin ? "bg-ink text-bg" : "border-b border-border bg-surface",
        )}
      >
        {!admin || narrow ? (
          <button
            aria-expanded={narrow ? drawer : railOpen}
            aria-label={narrow ? "Open menu" : railOpen ? "Collapse sidebar" : "Expand sidebar"}
            className={cn(
              "inline-flex size-10 shrink-0 items-center justify-center rounded-md",
              admin ? "hover:bg-bg/10" : "hover:bg-sunken",
            )}
            onClick={() => (narrow ? setDrawer(true) : setExpanded((v) => !v))}
            type="button"
          >
            <Menu aria-hidden className="size-5" />
          </button>
        ) : null}
        <Link
          aria-label="Sneakers-PAM home"
          className={cn(
            "flex items-center no-underline",
            admin ? "text-bg hover:text-bg" : "text-ink hover:text-ink",
          )}
          to={home}
        >
          <BrandForHeader admin={admin} compact={phone} />
        </Link>
        {label && !phone && (
          <span className="rounded-[6px] border-[1.5px] border-bg px-2 py-[5px] font-mono text-label font-bold tracking-[0.08em] uppercase">
            {label}
          </span>
        )}
        <EnvironmentBadge className={admin ? "border-bg" : undefined} />
        {search && !narrow && <div className="ml-6 max-w-110 flex-1">{search}</div>}
        <div className="ml-auto flex items-center gap-2 tablet:gap-2.5">
          {actions}
          {account}
        </div>
      </header>
      {banners}
      <div className="flex min-h-0 flex-1">
        {!narrow && (
          <aside
            aria-label="Sidebar"
            className={cn(
              "flex flex-none flex-col gap-5 overflow-x-hidden overflow-y-auto border-r border-border bg-surface px-3 py-4 transition-[width] duration-[320ms] ease-laces",
              railOpen ? (admin ? "w-65" : "w-68") : "w-17",
            )}
          >
            {sidebar(!railOpen)}
          </aside>
        )}
        <main
          className="flex min-w-0 flex-1 flex-col gap-6 overflow-x-hidden overflow-y-auto px-4 py-6 tablet:px-10 tablet:py-8"
          id="main"
        >
          {children}
        </main>
      </div>
      <div className="fixed right-4 bottom-4 z-(--z-a11y) tablet:right-5 tablet:bottom-5">
        <DisplayPanel storagePrefix={storagePrefix} />
      </div>
      {narrow && (
        <DialogPrimitive.Root onOpenChange={setDrawer} open={drawer}>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="fixed inset-0 z-(--z-sheet) bg-[rgb(12_14_20/0.35)]" />
            <DialogPrimitive.Content className="fixed inset-y-0 left-0 z-(--z-sheet) flex w-[86vw] max-w-80 flex-col gap-5 overflow-y-auto bg-surface px-3 py-4 shadow-dialog outline-none">
              <div className="flex items-center justify-between px-2">
                <DialogPrimitive.Title className="m-0">
                  <Brand />
                </DialogPrimitive.Title>
                <DialogPrimitive.Close
                  aria-label="Close menu"
                  className="inline-flex size-10 items-center justify-center rounded-md hover:bg-sunken"
                >
                  <X aria-hidden className="size-5" />
                </DialogPrimitive.Close>
              </div>
              <DialogPrimitive.Description className="sr-only">
                Navigation
              </DialogPrimitive.Description>
              {search && <div className="px-1">{search}</div>}
              {sidebar(false)}
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      )}
    </div>
  );
};

const BrandForHeader = ({ admin, compact }: { admin: boolean; compact: boolean }) => {
  return (
    <Brand
      hole={admin ? "var(--color-ink)" : "var(--color-surface)"}
      ink={admin ? "var(--color-bg)" : undefined}
      // On a phone the mark stands alone; the name stays for screen readers.
      wordmarkClassName={compact ? "hidden" : undefined}
    />
  );
};
