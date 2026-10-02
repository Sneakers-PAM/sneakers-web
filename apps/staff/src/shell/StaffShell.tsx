import { runtimeConfig } from "@sneakers-web/api-client";
import {
  AccountMenu,
  AppShell,
  HeaderButton,
  HeaderSearch,
  MfaBanner,
  NavItem,
  NavList,
  NotificationBell,
  useAuth,
  useShellCounts,
  useUser,
} from "@sneakers-web/shell";
import { CountBadge, useBreakpoint } from "@sneakers-web/ui";
import { ArrowLeftRight, LayoutGrid, Mail, SquareTerminal, Target } from "lucide-react";
import { Outlet, useNavigate } from "react-router";

/** The staff app frame: search, agent approvals, notifications, the admin link and the account menu. */
export const StaffShell = () => {
  const navigate = useNavigate();
  const user = useUser();
  const { isAdmin, signOut } = useAuth();
  const counts = useShellCounts(user.id).data;
  const phone = useBreakpoint() === "phone";

  return (
    <AppShell
      account={
        <AccountMenu
          compact={phone}
          email={user.email}
          items={[
            { label: "Security", onSelect: () => navigate("/security") },
            { label: "My tokens", onSelect: () => navigate("/tokens") },
            {
              label: "Approvals",
              meta: counts?.agentApprovals ? `${counts.agentApprovals} waiting` : undefined,
              onSelect: () => navigate("/approvals"),
            },
            { label: "Use grants", onSelect: () => navigate("/grants") },
          ]}
          name={user.name}
          onSignOut={() => void signOut()}
        />
      }
      actions={
        <>
          {!phone && (
            <HeaderButton
              aria-label="Agent approvals"
              onClick={() => navigate("/approvals")}
              tone="primary"
            >
              <SquareTerminal aria-hidden className="size-4" />
              Approvals
              {!!counts?.agentApprovals && <CountBadge count={counts.agentApprovals} />}
            </HeaderButton>
          )}
          <NotificationBell
            onOpenItem={(n) =>
              navigate(
                n.resourceKind === "secret"
                  ? `/secret/${n.resourceId}/sharing`
                  : `/folder/${n.resourceId}/sharing`,
              )
            }
          />
          {isAdmin && !phone && (
            <HeaderButton href={runtimeConfig().adminUrl}>Admin console</HeaderButton>
          )}
        </>
      }
      banners={<MfaBanner />}
      home="/"
      search={<HeaderSearch onSearch={(q) => navigate(`/secrets?q=${encodeURIComponent(q)}`)} />}
      sidebar={(collapsed) => (
        <NavList label="Primary">
          <NavItem collapsed={collapsed} end icon={<LayoutGrid />} label="Dashboard" to="/" />
          <NavItem
            collapsed={collapsed}
            count={counts?.checkouts}
            icon={<ArrowLeftRight />}
            label="Checkouts"
            to="/checkouts"
          />
          <NavItem
            collapsed={collapsed}
            count={counts?.requests}
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
