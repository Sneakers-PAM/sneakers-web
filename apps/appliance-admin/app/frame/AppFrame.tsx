import { edge } from "@sneakers-web/edge";
import { AccountMenu, AppShell, NavGroup, NavItem } from "@sneakers-web/shell";
import { Alert, Spinner, useBreakpoint } from "@sneakers-web/ui";
import {
  Activity,
  Archive,
  Boxes,
  FileText,
  KeyRound,
  Power,
  RefreshCw,
  ShieldCheck,
  SquareTerminal,
  Wifi,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router";

import { ApplianceAbout } from "@/components/ApplianceAbout";
import { NetworkChangeBanner } from "@/components/NetworkChangeBanner";
import { PagesUpdatedBanner } from "@/components/PagesUpdatedBanner";
import { StepUpDialog } from "@/components/StepUpDialog";
import { productPages } from "@/frame/productPages";
import { setup, signIn } from "@/lib/osadmin/client";
import { getSession, setSession } from "@/lib/osadmin/sessionStore";
import { useInstalledProduct } from "@/lib/useInstalledProduct";
import { useSession } from "@/lib/useSession";

/**
 * Mock builds only: `?quickLogin=<admin>` signs in without the code round trip, so the
 * review screen list can load every page already signed in. A literal, so a live build's
 * bundler drops this whole branch.
 */
const quickLoginFromUrl = (): boolean => {
  if (import.meta.env.SNEAKERS_MOCK !== "true" || !edge.quickLogin) return false;
  const name = new URLSearchParams(globalThis.location.search).get("quickLogin");
  if (!name) return false;
  const session = edge.quickLogin.signIn(name);
  if (!session) return false;
  setSession(session);
  return true;
};

/**
 * The signed-in frame: nav, the account menu and the shared step-up dialog. Redirects to
 * sign-in when there's no session, and to setup while the box is still in first boot.
 */
export const AppFrame = () => {
  const { session } = useSession();
  const [checked, setChecked] = useState(() => !!getSession() || quickLoginFromUrl());
  const [setupDone, setSetupDone] = useState<boolean | undefined>();
  const location = useLocation();
  const navigate = useNavigate();
  const phone = useBreakpoint() === "phone";
  const { product } = useInstalledProduct(!!session, location.pathname);

  useEffect(() => {
    if (getSession()) return;
    void signIn
      .getSession()
      .then((response) => setSession(response.session ?? null))
      .catch(() => setSession(null))
      .finally(() => setChecked(true));
  }, []);

  useEffect(() => {
    if (!session) return;
    void setup
      .get()
      .then((response) => setSetupDone(response.done))
      .catch(() => setSetupDone(true));
  }, [session]);

  if (!checked) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <Spinner />
      </div>
    );
  }
  if (!session) return <Navigate replace to="/" />;
  if (setupDone === false && location.pathname !== "/setup") {
    return <Navigate replace to="/setup" />;
  }

  return (
    <AppShell
      account={
        <AccountMenu
          app="appliance-admin"
          compact={phone}
          email={session.admin}
          items={[]}
          name={session.admin}
          onSignOut={() => {
            void signIn.signOut().finally(() => {
              setSession(null);
              navigate("/");
            });
          }}
          renderAbout={(props) => <ApplianceAbout {...props} />}
          role={session.role === "ROLE_OWNER" ? "owner" : "admin"}
        />
      }
      banners={
        <>
          <PagesUpdatedBanner />
          {session.notices?.map((notice) => (
            <Alert key={notice} role="status" tone="info">
              {notice}
            </Alert>
          ))}
          <NetworkChangeBanner pathname={location.pathname} />
          {setupDone === false && location.pathname === "/setup" && (
            <Alert role="status" tone="warn">
              First-boot setup isn&apos;t finished yet.
            </Alert>
          )}
        </>
      }
      home="/home"
      label="Appliance admin"
      sidebar={(collapsed) => (
        <>
          <NavGroup collapsed={collapsed} label="Appliance">
            <NavItem collapsed={collapsed} icon={<Activity />} label="Status" to="/home" />
            <NavItem collapsed={collapsed} icon={<RefreshCw />} label="Updates" to="/updates" />
            <NavItem collapsed={collapsed} icon={<Wifi />} label="Network" to="/network" />
            <NavItem collapsed={collapsed} icon={<KeyRound />} label="Access" to="/access" />
            {session.rootOperator && (
              <NavItem
                collapsed={collapsed}
                icon={<SquareTerminal />}
                label="Root shell"
                to="/root-shell"
              />
            )}
            <NavItem
              collapsed={collapsed}
              icon={<ShieldCheck />}
              label="Certificates"
              to="/certificates"
            />
            <NavItem collapsed={collapsed} icon={<Archive />} label="Backups" to="/backups" />
          </NavGroup>
          {product && (
            <NavGroup collapsed={collapsed} label={product.name}>
              {productPages.map((page) => (
                <NavItem
                  collapsed={collapsed}
                  icon={page.icon}
                  key={page.to}
                  label={page.label}
                  to={page.to}
                />
              ))}
            </NavGroup>
          )}
          <NavGroup collapsed={collapsed} label="Advanced">
            <NavItem collapsed={collapsed} icon={<Boxes />} label="Add-on modules" to="/modules" />
            <NavItem collapsed={collapsed} icon={<FileText />} label="Logs and audit" to="/logs" />
          </NavGroup>
          <NavGroup collapsed={collapsed} label="Power">
            <NavItem collapsed={collapsed} icon={<Power />} label="Power" to="/power" />
          </NavGroup>
        </>
      )}
      variant="admin"
    >
      <Outlet />
      <StepUpDialog />
    </AppShell>
  );
};
