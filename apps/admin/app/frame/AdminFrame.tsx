import {
  AccountMenu,
  ApplianceBanners,
  AppShell,
  HeaderButton,
  MfaBanner,
  NavGroup,
  NavItem,
  useRootData,
} from "@sneakers-web/shell";
import { Button, EmptyState, useBreakpoint } from "@sneakers-web/ui";
import {
  ArrowLeft,
  ArrowRightLeft,
  Bot,
  Diamond,
  ListChecks,
  Rows3,
  Target,
  User,
  Users,
} from "lucide-react";
import { Outlet, useLoaderData, useSubmit } from "react-router";

import type { loader } from "@/routes/frame";

/** The admin console frame. The header is inverted (an ink bar) so it's never mistaken for the user app. */
export const AdminFrame = () => {
  const { isAdmin, maintenance, maintenanceReason, mcpOff, mfaSetupRecommended, user } =
    useLoaderData<typeof loader>();
  const { config } = useRootData();
  const submit = useSubmit();
  const phone = useBreakpoint() === "phone";
  return (
    <AppShell
      account={
        <AccountMenu
          compact={phone}
          email={user.email}
          inverted
          items={
            phone
              ? [{ label: "User app", onSelect: () => globalThis.location.assign(config.staffUrl) }]
              : []
          }
          name={user.name}
          onSignOut={() => void submit(null, { action: "/sign-out", method: "post" })}
        />
      }
      actions={
        !phone && (
          <HeaderButton href={config.staffUrl} inverted>
            <ArrowLeft aria-hidden className="size-4" />
            User app
          </HeaderButton>
        )
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
      label="Admin console"
      sidebar={(collapsed) => (
        <>
          <NavGroup collapsed={collapsed} label="Configuration">
            <NavItem collapsed={collapsed} icon={<Target />} label="Targets" to="/targets" />
            <NavItem
              collapsed={collapsed}
              icon={<ArrowRightLeft />}
              label="Connections"
              to="/connections"
            />
            <NavItem collapsed={collapsed} icon={<Rows3 />} label="Types" to="/types" />
            <NavItem collapsed={collapsed} icon={<ListChecks />} label="Policies" to="/policies" />
          </NavGroup>
          <NavGroup collapsed={collapsed} label="Access">
            <NavItem collapsed={collapsed} icon={<User />} label="Users" to="/users" />
            <NavItem collapsed={collapsed} icon={<Users />} label="Groups" to="/groups" />
            <NavItem
              collapsed={collapsed}
              icon={<Bot />}
              label="Service accounts"
              to="/service-accounts"
            />
          </NavGroup>
          <NavGroup collapsed={collapsed} label="Governance">
            <NavItem collapsed={collapsed} icon={<Diamond />} label="Audit" to="/audit" />
          </NavGroup>
        </>
      )}
      variant="admin"
    >
      {isAdmin ? (
        <Outlet />
      ) : (
        <EmptyState
          action={
            <Button asChild variant="secondary">
              <a href={config.staffUrl}>Go to the user app</a>
            </Button>
          }
          body="The admin console is for site admins. Ask one if you need access."
          title="This console is for site admins"
        />
      )}
    </AppShell>
  );
};
