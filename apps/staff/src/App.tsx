import { AppProviders, Gate } from "@sneakers-web/shell";
import { Navigate, Route, Routes } from "react-router";

import { ComingSoonPage } from "@/pages/ComingSoonPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { StaffShell } from "@/shell/StaffShell";

/** The staff app: the vault people use every day. */
export const App = () => {
  return (
    <AppProviders basename="/">
      <Gate>
        <StaffRoutes />
      </Gate>
    </AppProviders>
  );
};

export const StaffRoutes = () => {
  return (
    <Routes>
      <Route element={<StaffShell />}>
        <Route element={<DashboardPage />} index />
        <Route element={<ComingSoonPage title="Checkouts" />} path="checkouts" />
        <Route element={<ComingSoonPage title="Requests" />} path="requests" />
        <Route element={<ComingSoonPage title="Targets" />} path="targets" />
        <Route element={<ComingSoonPage title="My tokens" />} path="tokens" />
        <Route element={<ComingSoonPage title="Agent approvals" />} path="approvals" />
        <Route element={<ComingSoonPage title="Use grants" />} path="grants" />
        <Route element={<ComingSoonPage title="Secrets" />} path="secrets" />
      </Route>
      <Route element={<Navigate replace to="/" />} path="*" />
    </Routes>
  );
};
