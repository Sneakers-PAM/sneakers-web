# AGENTS.md - sneakers-web

Guide for AI agents working in this repository. Pair with `CLAUDE.md` (the working agreement and
hook-enforced rules). Keep this file current when the build, layout, or public API changes.

## What this is

Sneakers web apps in one repo: staff, admin, appliance admin, maintenance, docs and the UI kit.
Today it ships two apps, the staff app (`apps/staff`, served at `/`) and the admin console
(`apps/admin`, served at `/admin/`). Both are React Router v7 framework-mode apps rendered on the
server (SSR), each built into its own Node server and container image.

Before changing anything, know two things:

- **Every gateway call runs on the app server.** Loaders and actions call the gateway through
  `GatewayClient` (`packages/api-client/src/gateway.ts`), forwarding only the gateway's session
  cookie and adding the CSRF token. The browser never calls the gateway, except for the
  full-page single sign-on redirect.
- **The edge is chosen at build time, never at run time.** Server code imports
  `@sneakers-web/edge.server`, which Vite aliases to the live edge
  (`packages/api-client/src/edge/live.server.ts`) or, only for `--mode mock`, the mock edge
  (`packages/mock-gateway/src/edge.server.ts`). App code never checks which one it got.

## Mock rules

- Mock mode comes only from `--mode mock` (`npm run dev:mock`, `build:mock`, or the image's
  `EDGE=mock`). A live build with `SNEAKERS_MOCK` set is refused.
- The mock gateway answers in-process with MSW in Node, at `mock-gateway.example.invalid`, a name
  that never resolves, so a mock request can't reach a real server.
- Mock and live never share state: the mock uses its own session cookie (`mock_sneakers_sid`),
  cookie prefix (`mock_`) and storage prefix (`mock:`).
- Every mock screen shows the "MOCK DATA, not a real server" banner.
- `npm run check:no-mock` fails if a live build (`apps/*/build`) contains the mock marker, and
  also if a mock build (`apps/*/build-mock`) lacks it. A live image installs no msw.

## Layout

- `apps/<app>/app/`: `root.tsx` (document, root loader, error screen), `routes.ts` (the route
  table), `routes/` (one module per route: loader, action, page), `frame/` (the signed-in frame),
  `entry.server.tsx` (starts the edge, then renders).
- `packages/shell/src/`: the shared pages (sign-in, reset, enrolment), the frame pieces and error
  screens; `server/` holds the server-only loaders and actions (`*.server.ts`, exported from
  `@sneakers-web/shell/server`).
- `packages/api-client/src/`: the gateway client, auth routes, errors, logger, public config and
  the generated GraphQL documents (`generated/`, rebuilt by `npm run schema:generate`).
- `packages/mock-gateway/src/`: fixtures, MSW handlers and the mock edge. `fixtures/world.ts` is
  the invented organisation the staff screens use (folders, secrets, targets, checkouts, requests,
  agent access), rebuilt by `resetMockState()`; handlers read and change `mockState.world`.
  Staff answers live in `handlers/staff/<area>.ts`, one module per area.
- `packages/ui/src/`: the Laces kit (components, theme, brand).
- `packages/vite-config/src/`: the shared Vite and Vitest config, and the edge choice.

Staff screens: one route module per page in `apps/staff/app/routes/` (the table in `routes.ts`
lists every page), screen-only components in `apps/staff/app/features/<area>/`, and the GraphQL
for an area in `packages/api-client/src/operations/staff/<area>.graphql`. Page tests render
through `renderRoute(url, routes, { user })` (`apps/staff/app/test/routeStub.tsx`), which signs in
a fixture user and puts the pages under the real frame loader. The staff app's tests run
against the mock gateway through `apps/staff/vitest.config.ts`, so the build config has no test
switch.

Paths inside an app are base-free (`appPath("sign-in")` is `/sign-in` in both apps). React
Router adds the `/admin/` basename to links and redirects; a redirect that leaves the app (single
sign-on) uses an absolute URL.

## Build, test, lint

- Build: `npm run build` (live, to `apps/*/build`) and `npm run build:mock` (to
  `apps/*/build-mock`). Run one locally with `npm run start -w @sneakers-web/staff`.
- Image: `docker build --build-arg APP=<staff|admin> [--build-arg EDGE=mock] .`
- Test: `npm test`. Server tests run in Node against the mock gateway, with the helpers in
  `@sneakers-web/mock-gateway/testing`: `withMockGateway()` for the file, `sessionCookie(userId)`
  for a signed-in fixture user, and `withCookie(cookie, loader)` to send it with a route's
  requests. Page tests use `createRoutesStub` with the real loaders and actions.
- End to end: `npm run test:e2e` builds and serves both mock builds and runs `e2e/*.spec.ts`
  (sign-in, theme kept across a reload, sign-out, SSO hand-back). Set `CHROME_PATH` to use an
  installed Chrome when Playwright's browser isn't downloaded.
- Lint: `npm run lint`; types: `npm run typecheck`.
- All of it, as CI runs it: `npm run check`.
- The app server is `server/serve.mjs` (Express with React Router's handler, built on
  `server/app.mjs`), used by `npm run start` and the image. `react-router-serve` isn't used: it
  can't be told to trust a proxy.
- `TRUST_PROXY`: set it when the app sits behind a TLS-terminating proxy, so the server takes the
  protocol and host from `X-Forwarded-Proto` and `X-Forwarded-Host` and same-origin form posts
  pass React Router's origin check. `true`, a hop count (`1`), or the proxies' addresses or CIDR
  ranges. Leave it unset when clients can reach the app directly: with it set, a direct client
  could claim any host.
- Runtime settings (server environment): `GATEWAY_URL`, `PORT`, `APP_ENV` (dev, qa, prod),
  `LOG_LEVEL`, `LOG_FORMAT` (`console` locally, JSON otherwise), `SSO_ENABLED`, `STAFF_URL`,
  `ADMIN_URL`. Only the public subset reaches the browser, through the root loader.

## Logging

Follow the logging rules in `CLAUDE.md`. In short:

- Log generously: entry and exit of significant operations, decisions and branches, retries, state
  changes, external calls (target, duration, outcome), and every error with its context.
- Levels: `trace` for step-by-step detail, `debug` for flow, `info` for lifecycle, `warn` and
  `error` for problems. The environment filters the volume, so err on the side of too much.
- Environments: local dev `trace` with `LOG_FORMAT=console` (never JSON), dev cluster `debug`,
  qa/staging `info`, production `error`. Every cluster environment logs JSON. Set levels through
  `LOG_LEVEL` and `LOG_FORMAT`, never in code; local settings live in the run target or
  `.env.example`.
- Never log secrets, tokens, or personal data, not even at `trace`. Log an opaque or keyed ID.

## Conventions and gotchas

- See `CLAUDE.md` for the branch/commit/PR rules; they are enforced by the git hooks in
  `.claude/hooks` (run `bash .claude/hooks/install.sh` once per clone).
- Open every PR as a draft. CI skips drafts, so run the full checks locally, push once they pass,
  and mark the PR ready when the work is finished; see CLAUDE.md "CI and Actions minutes".
- Install with `npm install --ignore-scripts`.
- Keep server-only code in `*.server.ts` modules so it never reaches the browser bundle.
