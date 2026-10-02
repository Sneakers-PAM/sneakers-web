import { cn, CountBadge, Tooltip } from "@sneakers-web/ui";
import { type ReactNode } from "react";
import { NavLink } from "react-router";

export interface NavItemProps {
  collapsed: boolean;
  count?: number;
  /** "primary" fills the count (things waiting on you); "muted" is a plain number. */
  countTone?: "muted" | "primary";
  end?: boolean;
  icon: ReactNode;
  label: string;
  to: string;
}

/** A labelled group of sidebar links, as the admin console uses. */
export const NavGroup = ({
  children,
  collapsed,
  label,
}: {
  children: ReactNode;
  collapsed: boolean;
  label: string;
}) => {
  return (
    <div className="flex flex-col gap-0.5">
      {!collapsed && <span className="eyebrow px-3 pb-2">{label}</span>}
      <nav aria-label={label} className="flex flex-col gap-0.5">
        {children}
      </nav>
    </div>
  );
};

/** A sidebar link: the current page gets the soft-primary fill and a bar on its left edge. */
export const NavItem = ({
  collapsed,
  count,
  countTone = "muted",
  end,
  icon,
  label,
  to,
}: NavItemProps) => {
  const link = (
    <NavLink
      aria-label={collapsed ? label : undefined}
      className={({ isActive }) =>
        cn(
          "flex h-11 items-center gap-3 rounded-md px-3 text-body font-bold text-ink no-underline hover:bg-sunken hover:text-ink [&_svg]:size-4.5",
          isActive &&
            "bg-primary-soft shadow-[inset_3px_0_0_var(--color-primary)] hover:bg-primary-soft",
          collapsed && "justify-center px-0",
        )
      }
      end={end}
      to={to}
    >
      {({ isActive }) => (
        <>
          <span
            aria-hidden
            className={cn("flex w-5 justify-center", isActive ? "text-primary" : "text-muted")}
          >
            {icon}
          </span>
          {!collapsed && (
            <>
              <span className="truncate">{label}</span>
              {!!count && <CountBadge className="ml-auto" count={count} tone={countTone} />}
            </>
          )}
        </>
      )}
    </NavLink>
  );
  return collapsed ? (
    <Tooltip content={label} side="right">
      {link}
    </Tooltip>
  ) : (
    link
  );
};

export const NavList = ({ children, label }: { children: ReactNode; label: string }) => {
  return (
    <nav aria-label={label} className="flex flex-col gap-0.5">
      {children}
    </nav>
  );
};
