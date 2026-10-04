import { cn, CountBadge } from "@sneakers-web/ui";
import { NavLink, useRouteLoaderData } from "react-router";

import type { loader as frameLoader } from "@/routes/frame";

const TABS = [
  { label: "Approvals", to: "/approvals" },
  { label: "My tokens", to: "/tokens" },
  { label: "Use grants", to: "/grants" },
] as const;

/**
 * Switches between the three agent pages. The frame's sidebar has no "Agents & tokens"
 * group yet, so the pages carry it themselves; Approvals shows the frame's waiting count.
 */
export const AgentTabs = () => {
  const frame = useRouteLoaderData<typeof frameLoader>("routes/frame");
  const waiting = frame?.counts.agentApprovals ?? 0;
  return (
    <nav aria-label="Agents and tokens" className="flex">
      <ul className="m-0 flex list-none gap-1 rounded-lg bg-sunken p-1">
        {TABS.map((t) => (
          <li key={t.to}>
            <NavLink
              className={({ isActive }) =>
                cn(
                  "flex h-9 items-center gap-2 rounded-[9px] px-3.5 text-[0.875rem] font-bold text-ink no-underline transition-colors duration-[120ms] ease-laces hover:bg-surface/60",
                  isActive && "bg-surface shadow-seg",
                )
              }
              to={t.to}
            >
              {t.label}
              {t.to === "/approvals" && waiting > 0 && <CountBadge count={waiting} />}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
};
