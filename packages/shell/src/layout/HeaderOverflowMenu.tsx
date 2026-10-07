import type { ReactNode } from "react";

import {
  cn,
  CountBadge,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  useWideDesktop,
} from "@sneakers-web/ui";
import { MoreHorizontal } from "lucide-react";

import { HeaderButton } from "#shell/layout/AccountMenu";

export interface HeaderAction {
  "aria-label"?: string;
  badge?: number;
  href?: string;
  icon?: ReactNode;
  key: string;
  label: string;
  onClick?: () => void;
  tone?: "primary";
}

/**
 * Extra header buttons (agent approvals, break glass, the admin console link): inline at full
 * desktop width, where there's room; collapsed into one "More actions" menu at every narrower
 * width, tablet included, so they're never pushed off the edge of the header.
 */
export const HeaderOverflowMenu = ({
  actions,
  inverted,
}: {
  actions: HeaderAction[];
  inverted?: boolean;
}) => {
  const wide = useWideDesktop();
  if (actions.length === 0) return null;

  if (wide) {
    return (
      <>
        {actions.map((a) => (
          <HeaderButton
            aria-label={a["aria-label"] ?? a.label}
            href={a.href}
            inverted={inverted}
            key={a.key}
            onClick={a.onClick}
            tone={a.tone}
          >
            {a.icon}
            {a.label}
            {!!a.badge && <CountBadge count={a.badge} />}
          </HeaderButton>
        ))}
      </>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="More actions"
        className={cn(
          "inline-flex size-10 shrink-0 items-center justify-center rounded-md border-[1.5px]",
          inverted
            ? "border-bg text-bg hover:bg-bg/10"
            : "border-border-strong bg-surface text-ink hover:bg-sunken",
        )}
      >
        <MoreHorizontal aria-hidden className="size-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {actions.map((a) =>
          a.href ? (
            <DropdownMenuItem asChild key={a.key}>
              <a href={a.href}>
                {a.icon}
                {a.label}
              </a>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem key={a.key} onSelect={a.onClick}>
              {a.icon}
              {a.label}
              {!!a.badge && (
                <span className="ml-auto font-mono text-[0.75rem] font-bold text-muted">
                  {a.badge}
                </span>
              )}
            </DropdownMenuItem>
          ),
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
