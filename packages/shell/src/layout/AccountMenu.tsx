import {
  Avatar,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@sneakers-web/ui";
import { ChevronDown } from "lucide-react";
import { type ReactNode, useState } from "react";

import { AboutDialog } from "#shell/diagnostics/AboutDialog";
import { IssueCopyMenuItem } from "#shell/issueCopy/IssueCopyMenuItem";

export interface AccountMenuItem {
  label: string;
  meta?: string;
  onSelect: () => void;
}

/**
 * The account chip in the header, and its menu: the app's items, the dev-only UI issue copy
 * item and About and diagnostics, then Sign out at the bottom.
 */
export const AccountMenu = ({
  app,
  compact,
  developmentUiIssueCopy = false,
  email,
  inverted,
  items = [],
  name,
  onSignOut,
  renderAbout = (props) => <AboutDialog {...props} />,
  role = "",
}: {
  app: string;
  compact?: boolean;
  /** The server's half of the dev-only UI issue copy item's gate. */
  developmentUiIssueCopy?: boolean;
  email: string;
  inverted?: boolean;
  items?: AccountMenuItem[];
  name: string;
  onSignOut: () => void;
  /**
   * The About and diagnostics dialog, for an app whose build has no gateway-shaped
   * diagnostics to show (the appliance admin, a static SPA with no app server). Defaults to
   * the gateway-shaped AboutDialog every other app uses.
   */
  renderAbout?: (props: { onOpenChange: (open: boolean) => void; open: boolean }) => ReactNode;
  role?: string;
}) => {
  const [about, setAbout] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Account: ${name}`}
          className={cn(
            "flex items-center gap-2.5 rounded-lg border-[1.5px] py-1 pr-2.5 pl-1 text-[0.875rem] font-bold",
            inverted
              ? "border-bg text-bg hover:bg-bg/10"
              : "border-border-strong bg-surface text-ink hover:bg-sunken",
          )}
        >
          <Avatar name={name} tone={inverted ? "ok" : "primary"} />
          {!compact && <span>{name}</span>}
          {!compact && (
            <ChevronDown
              aria-hidden
              className={cn("size-3.5", inverted ? "text-bg" : "text-muted")}
            />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-65">
          <DropdownMenuLabel>
            <b className="text-body leading-none">{name}</b>
            {email && (
              <span className="text-small leading-none font-normal text-muted">{email}</span>
            )}
          </DropdownMenuLabel>
          {items.map((it) => (
            <DropdownMenuItem key={it.label} onSelect={it.onSelect}>
              {it.label}
              {it.meta && (
                <span className="ml-auto font-mono text-[0.75rem] font-bold text-muted">
                  {it.meta}
                </span>
              )}
            </DropdownMenuItem>
          ))}
          <IssueCopyMenuItem
            app={app}
            developmentUiIssueCopy={developmentUiIssueCopy}
            role={role}
          />
          <DropdownMenuItem onSelect={() => setAbout(true)}>About and diagnostics</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onSignOut} tone="strong">
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {renderAbout({ onOpenChange: setAbout, open: about })}
    </>
  );
};

/** A plain outlined header button (Admin console, User app). */
export const HeaderButton = ({
  children,
  href,
  inverted,
  onClick,
  tone,
  ...rest
}: {
  "aria-label"?: string;
  children: ReactNode;
  href?: string;
  inverted?: boolean;
  onClick?: () => void;
  tone?: "primary";
}) => {
  const cls = cn(
    "inline-flex h-10 items-center gap-2 rounded-md border-[1.5px] px-3.5 text-[0.875rem] font-bold whitespace-nowrap no-underline",
    inverted
      ? "border-bg text-bg hover:bg-bg/10 hover:text-bg"
      : tone === "primary"
        ? "border-primary bg-primary-soft text-primary hover:text-primary"
        : "border-border-strong bg-surface text-ink hover:bg-sunken hover:text-ink",
  );
  if (href) {
    return (
      <a className={cls} href={href} {...rest}>
        {children}
      </a>
    );
  }
  return (
    <button className={cls} onClick={onClick} type="button" {...rest}>
      {children}
    </button>
  );
};
