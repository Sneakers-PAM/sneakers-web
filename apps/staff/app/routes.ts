import { index, layout, route, type RouteConfig } from "@react-router/dev/routes";

// One module per page. A module serving two paths gets an id for the second, since route ids
// default to the file name.
export default [
  route("sign-in", "routes/sign-in.tsx"),
  route("sign-in/reset", "routes/sign-in.reset.tsx"),
  route("enroll", "routes/enroll.tsx"),
  route("sign-out", "routes/sign-out.tsx"),
  route("resources/diagnostics", "routes/resources.diagnostics.tsx"),
  route("resources/display", "routes/resources.display.tsx"),
  route("resources/notifications", "routes/resources.notifications.tsx"),
  route("resources/step-up", "routes/resources.step-up.tsx"),
  route("healthz", "routes/healthz.tsx"),
  route("oauth/consent", "routes/oauth.consent.tsx"),
  route("approvals/run/:runId", "routes/approvals.run.tsx"),
  route("secret/:id/terminal", "routes/terminal.tsx"),
  layout("routes/frame.tsx", [
    index("routes/home.tsx"),
    route("secrets", "routes/secrets.tsx"),
    route("browse", "routes/browse.tsx"),
    route("browse/:folderId", "routes/browse.tsx", { id: "routes/browse-folder" }),
    route("secret/new", "routes/secret.new.tsx"),
    route("secret/:id", "routes/secret.tsx"),
    route("secret/:id/edit", "routes/secret.edit.tsx"),
    route("folder/:id/sharing", "routes/sharing.tsx"),
    route("secret/:id/sharing", "routes/sharing.tsx", { id: "routes/sharing-secret" }),
    route("checkouts", "routes/checkouts.tsx"),
    route("requests", "routes/requests.tsx"),
    route("targets", "routes/targets.tsx"),
    route("targets/new", "routes/target.tsx"),
    route("targets/:id", "routes/target.tsx", { id: "routes/target-edit" }),
    route("tokens", "routes/tokens.tsx"),
    route("approvals", "routes/approvals.tsx"),
    route("grants", "routes/grants.tsx"),
    route("security", "routes/security.tsx"),
  ]),
  route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;
