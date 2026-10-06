import {
  AccountMenu,
  ApplianceBanners,
  AppShell,
  HeaderButton,
  HeaderSearch,
  MfaBanner,
  NavItem,
  NavList,
  NotificationBell,
  useQuietRefresh,
  useRootData,
} from "@sneakers-web/shell";
import { CountBadge, useBreakpoint } from "@sneakers-web/ui";
import { ArrowLeftRight, LayoutGrid, Mail, SquareTerminal, Target } from "lucide-react";
import { Outlet, useLoaderData, useNavigate, useSubmit } from "react-router";

import type { loader } from "@/routes/frame";

const REFRESH_MS = 30_000;

/** The staff app frame: search, agent approvals, notifications, the admin link and the account menu. */
export const StaffFrame = () => {
  const {
    counts,
    isAdmin,
    maintenance,
    maintenanceReason,
    mcpOff,
    mfaSetupRecommended,
    unread,
    user,
  } = useLoaderData<typeof loader>();
  const { config } = useRootData();
  const navigate = useNavigate();
  const submit = useSubmit();
  const phone = useBreakpoint() === "phone";
  useQuietRefresh(REFRESH_MS);

  return (
    <AppShell
      account={
        <AccountMenu
          compact={phone}
          email={user.email}
          items={[
            { label: "Security", onSelect: () => void navigate("/security") },
            { label: "My tokens", onSelect: () => void navigate("/tokens") },
            {
              label: "Approvals",
              meta: counts.agentApprovals ? `${counts.agentApprovals} waiting` : undefined,
              onSelect: () => void navigate("/approvals"),
            },
            { label: "Use grants", onSelect: () => void navigate("/grants") },
          ]}
          name={user.name}
          onSignOut={() => void submit(null, { action: "/sign-out", method: "post" })}
        />
      }
      actions={
        <>
          {!phone && (
            <HeaderButton
              aria-label="Agent approvals"
              onClick={() => void navigate("/approvals")}
              tone="primary"
            >
              <SquareTerminal aria-hidden className="size-4" />
              Approvals
              {counts.agentApprovals > 0 && <CountBadge count={counts.agentApprovals} />}
            </HeaderButton>
          )}
          <NotificationBell
            initialUnread={unread}
            onOpenItem={(n) =>
              void navigate(
                n.resourceKind === "secret"
                  ? `/secret/${n.resourceId}/sharing`
                  : `/folder/${n.resourceId}/sharing`,
              )
            }
          />
          {isAdmin && !phone && <HeaderButton href={config.adminUrl}>Admin console</HeaderButton>}
        </>
      }
      banners={
        <>
          <ApplianceBanners
            maintenance={maintenance}
            maintenanceReason={maintenanceReason}
            mcpOff={mcpOff}
          />
          <MfaBanner show={mfaSetupRecommended} />
        </>
      }
      home="/"
      search={
        <HeaderSearch onSearch={(q) => void navigate(`/secrets?q=${encodeURIComponent(q)}`)} />
      }
      sidebar={(collapsed) => (
        <NavList label="Primary">
          <NavItem collapsed={collapsed} end icon={<LayoutGrid />} label="Dashboard" to="/" />
          <NavItem
            collapsed={collapsed}
            count={counts.checkouts}
            icon={<ArrowLeftRight />}
            label="Checkouts"
            to="/checkouts"
          />
          <NavItem
            collapsed={collapsed}
            count={counts.requests}
            countTone="primary"
            icon={<Mail />}
            label="Requests"
            to="/requests"
          />
          <NavItem collapsed={collapsed} icon={<Target />} label="Targets" to="/targets" />
        </NavList>
      )}
    >
      <Outlet />
    </AppShell>
  );
};
