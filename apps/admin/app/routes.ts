import { index, layout, route, type RouteConfig } from "@react-router/dev/routes";

const PAGES = [
  "targets",
  "connections",
  "types",
  "policies",
  "users",
  "groups",
  "service-accounts",
  "audit",
  "folders",
];

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
    ...PAGES.map((p) => route(p, "routes/coming-soon.tsx", { id: p })),
  ]),
  route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;
