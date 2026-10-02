import { index, layout, route, type RouteConfig } from "@react-router/dev/routes";

export default [
  route("sign-in", "routes/sign-in.tsx"),
  route("sign-in/reset", "routes/sign-in.reset.tsx"),
  route("enroll", "routes/enroll.tsx"),
  route("sign-out", "routes/sign-out.tsx"),
  route("resources/display", "routes/resources.display.tsx"),
  route("resources/notifications", "routes/resources.notifications.tsx"),
  route("resources/step-up", "routes/resources.step-up.tsx"),
  route("healthz", "routes/healthz.tsx"),
  layout("routes/frame.tsx", [
    index("routes/home.tsx"),
    route("checkouts", "routes/coming-soon.tsx", { id: "checkouts" }),
    route("requests", "routes/coming-soon.tsx", { id: "requests" }),
    route("targets", "routes/coming-soon.tsx", { id: "targets" }),
    route("tokens", "routes/coming-soon.tsx", { id: "tokens" }),
    route("approvals", "routes/coming-soon.tsx", { id: "approvals" }),
    route("grants", "routes/coming-soon.tsx", { id: "grants" }),
    route("secrets", "routes/coming-soon.tsx", { id: "secrets" }),
    route("security", "routes/coming-soon.tsx", { id: "security" }),
  ]),
  route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;
