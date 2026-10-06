import {
  AccountMenu,
  ApplianceBanners,
  AppShell,
  BreakGlassBanner,
  HeaderButton,
  HeaderSearch,
  MfaBanner,
  NavItem,
  NavList,
  NotificationBell,
  primaryRole,
  useQuietRefresh,
  useRootData,
} from "@sneakers-web/shell";
import { CountBadge, useBreakpoint } from "@sneakers-web/ui";
import {
  ArrowLeftRight,
  LayoutGrid,
  Mail,
  SquareTerminal,
  Target,
  TriangleAlert,
} from "lucide-react";
import { Outlet, useLoaderData, useNavigate, useSubmit } from "react-router";

import type { loader } from "@/routes/frame";

import { FolderSidebar } from "@/features/browse/FolderSidebar";

const REFRESH_MS = 30_000;

/** The staff app frame: search, agent approvals, notifications, the admin link and the account menu. */
export const StaffFrame = () => {
  const {
    breakGlass,
    counts,
    folders,
    isAdmin,
    maintenance,
    maintenanceReason,
    mcpOff,
    mfaSetupRecommended,
    unread,
    user,
  } = useLoaderData<typeof loader>();
  const { config, developmentUiIssueCopy } = useRootData();
  const navigate = useNavigate();
  const submit = useSubmit();
  const phone = useBreakpoint() === "phone";
  useQuietRefresh(REFRESH_MS);

  return (
    <AppShell
      account={
        <AccountMenu
          app="staff"
          compact={phone}
          developmentUiIssueCopy={developmentUiIssueCopy}
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
            ...(isAdmin
              ? [{ label: "Break glass", onSelect: () => void navigate("/break-glass") }]
              : []),
          ]}
          name={user.name}
          onSignOut={() => void submit(null, { action: "/sign-out", method: "post" })}
          role={primaryRole(user)}
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
          {isAdmin && !phone && !breakGlass && (
            <HeaderButton aria-label="Break glass" onClick={() => void navigate("/break-glass")}>
              <TriangleAlert aria-hidden className="size-4" />
              Break glass
            </HeaderButton>
          )}
          {isAdmin && !phone && <HeaderButton href={config.adminUrl}>Admin console</HeaderButton>}
        </>
      }
      banners={
        <>
          <BreakGlassBanner browse={{ href: "/break-glass", inApp: true }} session={breakGlass} />
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
        <>
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
          <FolderSidebar collapsed={collapsed} folders={folders} isAdmin={isAdmin} />
        </>
      )}
    >
      <Outlet />
    </AppShell>
  );
};
