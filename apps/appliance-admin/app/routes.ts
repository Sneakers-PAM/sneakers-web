import { index, layout, route, type RouteConfig } from "@react-router/dev/routes";

export default [
  index("routes/sign-in.tsx"),
  route("setup", "routes/setup.tsx"),
  route("unauthorized", "routes/unauthorized.tsx"),
  route("forbidden", "routes/forbidden.tsx"),
  route("server-error", "routes/server-error.tsx"),
  layout("routes/frame.tsx", [
    route("home", "routes/home.tsx"),
    route("updates", "routes/updates.tsx"),
    route("network", "routes/network.tsx"),
    route("access", "routes/access.tsx"),
    route("root-shell", "routes/root-shell.tsx"),
    route("certificates", "routes/certificates.tsx"),
    route("backups", "routes/backups.tsx"),
    route("mcp", "routes/mcp.tsx"),
    route("modules", "routes/modules.tsx"),
    route("logs", "routes/logs.tsx"),
    route("power", "routes/power.tsx"),
  ]),
  route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;
