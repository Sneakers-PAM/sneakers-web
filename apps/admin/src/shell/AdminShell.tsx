import { runtimeConfig } from "@sneakers-web/api-client";
import {
  AccountMenu,
  AppShell,
  HeaderButton,
  MfaBanner,
  NavGroup,
  NavItem,
  useAuth,
  useUser,
} from "@sneakers-web/shell";
import { useBreakpoint } from "@sneakers-web/ui";
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
import { Outlet } from "react-router";

/** The admin console frame. The header is inverted (an ink bar) so it's never mistaken for the user app. */
export const AdminShell = () => {
  const user = useUser();
  const { signOut } = useAuth();
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
              ? [
                  {
                    label: "User app",
                    onSelect: () => globalThis.location.assign(runtimeConfig().staffUrl),
                  },
                ]
              : []
          }
          name={user.name}
          onSignOut={() => void signOut()}
        />
      }
      actions={
        !phone && (
          <HeaderButton href={runtimeConfig().staffUrl} inverted>
            <ArrowLeft aria-hidden className="size-4" />
            User app
          </HeaderButton>
        )
      }
      banners={<MfaBanner />}
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
      <Outlet />
    </AppShell>
  );
};
