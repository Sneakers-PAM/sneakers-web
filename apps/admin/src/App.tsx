import { AppProviders, Gate } from "@sneakers-web/shell";
import { Navigate, Route, Routes } from "react-router";

import { ComingSoonPage } from "@/pages/ComingSoonPage";
import { AdminShell } from "@/shell/AdminShell";

const PAGES: [string, string][] = [
  ["targets", "Targets"],
  ["connections", "Connections"],
  ["types", "Secret types"],
  ["policies", "Password policies"],
  ["users", "Users"],
  ["groups", "Groups"],
  ["service-accounts", "Service accounts"],
  ["audit", "Audit trail"],
  ["folders", "Shared folders"],
];

export const AdminRoutes = () => {
  return (
    <Routes>
      <Route element={<AdminShell />}>
        <Route element={<Navigate replace to="/folders" />} index />
        {PAGES.map(([path, title]) => (
          <Route element={<ComingSoonPage title={title} />} key={path} path={path} />
        ))}
      </Route>
      <Route element={<Navigate replace to="/folders" />} path="*" />
    </Routes>
  );
};

/** The admin console: configuration, access and governance. */
export const App = () => {
  return (
    <AppProviders basename="/admin">
      <Gate>
        <AdminRoutes />
      </Gate>
    </AppProviders>
  );
};
