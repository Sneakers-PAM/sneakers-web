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
  also if a mock build (`apps/*/build-mock`) lacks it. A live image installs no msw. CI runs it
  in the Test workflow's build job.

## Dev quick login

A "Dev quick login" dropdown (DEV badge) under the username field signs in as a test user in
one pick. It never ships in a release.

- Mock builds offer the mock world's fixture users (`edge.quickLogin`, intent
  `mock-quick-login`).
- A live build offers it only with two switches on. At build time: the dev server
  (`npm run dev`) always has it, and a production build only with
  `SNEAKERS_DEV_QUICK_LOGIN_BUILD=true` (the image's `DEV_QUICK_LOGIN=true` build argument, for
  a local stack). At run time: the server needs `SNEAKERS_DEV_QUICK_LOGIN=true` and
  `SNEAKERS_DEV_QUICK_LOGIN_USERS`, the path of a local JSON file listing the seeded dev
  accounts: `[{ "username": "alice", "password": "...", "label": "Alice", "note": "site admin" }]`
  (`label` and `note` optional). The file is read on the server
  (`packages/shell/src/server/developmentQuickLogin.server.ts`); the page gets only each username, label
  and note. Picking one posts intent `dev-quick-login`, and the action signs that account in
  with its password through the gateway's login, the same step as the password form, second
  factor included. Keep the file out of the repo. A seeded account is never the account someone
  ran `/setup` with, even when its username or label reads like "admin", so this variant of
  `QuickLogin` always shows a caption saying so; a mock build's fixture users don't need it,
  they're obviously not real to begin with.
- Release builds can't turn it on: the build flag is a literal, so a release build drops the
  code, and `check:no-mock` fails if a live build (`apps/*/build`) has its intents, label or
  variable names, or if the Dockerfile's `DEV_QUICK_LOGIN` argument defaults to anything but
  `false`. The chart sets none of it.

## Brand mark

The brand mark is the still `Mark` everywhere it stands for the brand (the sign-in panel, empty
states, the no-access cards, the setup "all set" screen). The animated `SneakerLoader` is only for
loading states: the connecting screen and the hand-off after sign-in.

## Layout

- `apps/<app>/app/`: `root.tsx` (document, root loader, error screen), `routes.ts` (the route
  table), `routes/` (one module per route: loader, action, page), `frame/` (the signed-in frame),
  `entry.server.tsx` (starts the edge, then renders).
- `apps/admin/app/lib/admin.server.ts`: `adminLoad` (a page's data; a refusal becomes a 403 or 404
  for the page's `PageError` boundary) and `adminAct` (one form intent; a refusal comes back as
  data for the toast). `components/` holds the console's own pieces (`Panel`, `SettingRow`).
  Route tests (`routes/*.test.tsx`) mount the real loaders and actions with `renderAdmin` from
  `app/test/stub.tsx`, as a chosen fixture user.
- `packages/shell/src/`: the shared pages (sign-in, reset, enrolment), the frame pieces and error
  screens; `server/` holds the server-only loaders and actions (`*.server.ts`, exported from
  `@sneakers-web/shell/server`).
- `packages/api-client/src/`: the gateway client, auth routes, errors, logger, public config and
  the generated GraphQL documents (`generated/`, rebuilt by `npm run schema:generate`).
- `packages/mock-gateway/src/`: fixtures, MSW handlers and the mock edge. `fixtures/world.ts` is
  the invented organisation the staff and admin screens use (folders, secrets, secret types,
  targets, groups and their members, personal tokens, checkouts, requests, agent access), rebuilt
  by `resetMockState()`; handlers read and change `mockState.world`, so both apps always see the
  same data. The admin console's operations live in `admin/` (one file per area, collected in
  `admin/handlers.ts`). State only the console uses (password policies, security settings, the
  extension packs not yet installed) stays there and registers its reset with `onMockReset`.
  A mock server started with `MOCK_FRESH_INSTALL=1` has no administrator yet, so the admin console
  opens first-run setup (the setup token is `mock-setup-token`). Live builds never contain the
  mock edge, so the variable does nothing there.
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

Browse (U-03): the folder tree (`features/browse/FolderNav`, personal pinned, shared as a
parent/child tree) lives in the frame's left main nav (`frame/FolderSidebar`), not the page, so
it's there on every route. The frame loader (`routes/frame.tsx`) fetches the folder list; since
`routeStub.tsx`'s `renderRoute` doesn't draw the frame's chrome, a page test never sees the tree —
cover it against `StaffFrame` directly (`apps/staff/app/frame/StaffFrame.test.tsx`). Off `/browse`,
a tree mutation posts explicitly to `/browse` (there's no route in context to default to); on it,
to the open folder's own path, so a delete of the folder you're viewing still gets its redirect.
Moves follow the vault's gate (`moveKind` in `features/browse/tree.ts`): a personal folder going
shared is confirmed first, and shared into someone's personal folder is a folder_move or
secret_move request unless the user is a site admin. The mock's canManage comes from the owners of
the folder or any folder above it, and read access from ownership, the folder's group or its role.

Paths inside an app are base-free (`appPath("sign-in")` is `/sign-in` in both apps). React
Router adds the `/admin/` basename to links and redirects; a redirect that leaves the app (single
sign-on) uses an absolute URL.

## Refusals and step-up

- A gateway refusal arrives as `GraphQLRequestError` with `code`, `reason` and `metadata`. In an
  action, turn it into data with `refusalOf(error)` (`@sneakers-web/shell`) and show
  `refusalMessage(refusal)`; match on `reason` and `code`, never on the text.
- `STEP_UP_REQUIRED` means the vault wants a fresh second factor. The page opens
  `StepUpDialog` (wired with `useStepUp()`); it posts to the app's `resources/step-up` route
  (`stepUpAction`, which calls `POST /auth/mfa/step-up`) and, once the factor checks out, runs
  the retry the page gave it. Five wrong proofs end the session, and the prompt sends the person
  to sign in.
- The mock gateway counts a step-up as fresh for 30 minutes (`freshMfa`, the gateway's default
  `MFA_MAX_AGE`), and a session that never stepped up as stale, so the prompt shows the first time
  in mock mode.
- Where a reveal or copy asks for one follows the vault: the nearest folder (this one, then up the
  tree) whose reveal step-up is `require` or `off` wins, else the global "MFA before a reveal"
  security setting (`revealStepUpRequired` in the mock). Site admins set a folder's override on the
  admin console's folder page. In the fixtures the Certificates folder requires it, so a private
  key reveal prompts. A check-out of a type with a super-sensitive field asks for one while "MFA
  for sensitive checkout" is on (the default).

## Manage controls on a secret

- A secret's settings (Automation, Approvals) are gated on `access.manage` — the vault's RACI
  author decision — never on `isAdmin`. A site admin who isn't an owner or author gets the same
  `access.manage: false` as any other reader; admins get no extra edit rights here.
- The controls still show for everyone who can see the page; a viewer without `access.manage`
  sees the current value with the control disabled, not hidden, so nobody is invited into a
  change the vault will only refuse. `SettingsCards.tsx` (`AutomationCard`, `AgentAccessCard`) and
  the Actions menu's Replace certificate, Rotate now, Restore/Retire items (`SecretPage.tsx`)
  follow this: `showManage` (`access.manage || isAdmin`) decides whether the control renders,
  `access.manage` alone decides whether it's enabled, and a disabled one carries a short hint.
- The one exception is a folder's ruleset and sharing: those pass `ownsFolder`/`manageRuleset`,
  which includes site admins by design, so they stay editable for admins on the sharing page.

## Appliance banners

- `ApplianceBanners` (`packages/shell/src/layout/ApplianceBanners.tsx`) is read-only: the
  maintenance banner and the MCP-off notice, shown by both `StaffFrame` and `AdminFrame` on every
  page. There's no control here; the appliance's own platform controller flips both switches.
- The data comes from `frameData` (`packages/shell/src/server/frame.server.ts`), which queries the
  gateway's `appliance` field (`ApplianceStatusDocument`) alongside the unread count. A query
  failure (an older gateway, a blip) falls back to both banners off, the same as a plain install.
- The maintenance banner shows while `appliance.maintenance` is true, with `appliance.
  maintenanceReason` when the appliance gave one. The MCP notice shows when `appliance.mcp` is
  `"off"` (it's also `"on"` or `"degraded"`; only off has copy today).
- The mock gateway answers with `mockAppliance.current` (`packages/mock-gateway/src/handlers/
  graphql.ts`, re-exported from `@sneakers-web/mock-gateway`), which resets to a plain install
  (`present: false`, every other field null or false) between tests. Set it before rendering to
  mock either banner on.

## Copy diagnostics

- `CopyDiagnostics` (`packages/shell/src/diagnostics/`) copies a support report as plain text
  plus a JSON block: the time (UTC and the browser's zone), the path and route, the problem
  (message, operation, code, reason, domain, trace id), the user (id, username, roles), the app's
  build, the appliance, every service's and third party's version with its dependency states, and
  the user agent. `buildReport` copies named fields only and runs every string through `scrub`, so
  no token, cookie, session id or field value can reach the clipboard; the URL is cut to its path.
- The data comes from each app's `resources/diagnostics` route (`diagnosticsLoader`): the app's
  build (`__APP_VERSION__`, `__APP_COMMIT__`, stamped from `APP_VERSION` and `APP_COMMIT` at build
  time) and, for a signed-in user, the gateway's `diagnostics` query. Signed out or with the
  gateway down, the gateway part is null and the report still has the page and the app.
- Problem treatments get it without per-screen code. `AppRoot` (and the route stubs) mount
  `ProblemActions`, so every `Alert` with tone `danger` or `warn` shows the button, and every
  `toast.error` without its own action offers it. `refusalMessage` remembers which refusal each
  sentence stood for, so the report names the operation and trace behind the message the screen
  showed. The crash, offline and not-found screens show the button themselves.
- The account menu of both apps has About and diagnostics (`AboutDialog`): every version and the
  copy button.
- The mock gateway answers `diagnostics` with `mock-` versions.

## Agent approvals

The vault decides who needs an approval, from the secret's approval level: normal,
approval-required (owners exempt, anyone else needs one owner) or always-approve (everyone, owners
included, needs another owner or a designated approver, RACI A). The levels cover a person
revealing in the web and an agent's personal token alike. Nobody approves their own request; when
nobody else can decide, the requester confirms the task once with their second factor.

- `/approvals` has two lists. "Waiting for you to decide" is `secretUsesToDecide`: other
  people's requests for secrets the user owns or approves, each approved with a factor (or the
  session's step-up window) or denied (`decideSecretUse`). "Your requests" is the user's own
  `pendingSecretUses`: each says whether an owner or approver decides it or links to its run page
  to confirm it, and can be withdrawn (a deny of one's own request).
- `/approvals/run/<runId>` (`routes/approvals.run.tsx`, `features/agents/RunApproval.tsx`) is the
  page an agent's link opens for one of the user's runs: every pending use it raised, all ticked.
  The uses marked `confirm` are confirmed together with `confirmSecretUses`; the rest show that an
  owner or approver decides them. Any of them can be withdrawn together. It sits outside the
  frame, full-screen on a phone and a centred card on wider screens.
- The factor is proved once, through `POST /auth/mfa/step-up` (`runAction` steps up, then
  confirms the batch with no factor of its own), so the session's `MFA_MAX_AGE` window also covers
  a follow-up batch. While `secretUseRun.mfaFreshUntilUnix` is in the future the page shows no
  factor input. If the window closes before the click, the gateway answers `STEP_UP_REQUIRED` and
  the page asks for the code again, keeping the ticks.
- `/oauth/consent?req=<id>` (`routes/oauth.consent.tsx`, `features/agents/ConsentPage.tsx`) is
  the page an agent's `/login` opens. The gateway's `factorRequired` says whether the sign-in
  factor is still within `MFA_MAX_AGE`; while it is, the page shows no factor input and Allow sends
  none, so a cold `/login` costs one prompt (the sign-in). Otherwise, or when the gateway answers
  `step_up_required` on Allow, the page asks for a code, an email code or a passkey.
- A refused item comes back with its reason (`EXPIRED`, `ALREADY_DECIDED`, `NOT_FOUND`,
  `NOT_PERMITTED`, `UNAVAILABLE`, `SELF_APPROVAL`, `OTHER_APPROVER`, `NO_APPROVER`), shown as a
  fixed sentence (`RUN_REFUSAL` in `features/agents/messages.ts`); the rest of the batch is still
  settled.
- On a secret's page, a reveal or copy the level holds (`APPROVAL_REQUIRED`) becomes a web reveal
  use (`prepareSecretReveal`, intent `reveal`): the field shows that it's waiting for an owner or
  approver, or asks to confirm the task, links to the run page, and checks back every 5 seconds
  (intent `reveal-collect`, `redeemSecretReveal`) until it's released. Every reveal on one visit
  shares a run id (`features/secret/revealRun.tsx`), so one task asks once. The Approvals panel
  sets the level (off, non-owners, everyone).
- The agent's `purpose` is shown as plain text, labelled "Agent says", never as product copy.
- The mock gateway answers these operations (`handlers/staff/agentRuns.ts`, `agents.ts`,
  `secret.ts`, with the rules in `approval.ts`) with the vault's and gateway's rules: 1 to 20
  distinct ids (`BATCH_SIZE_INVALID`), an approval or confirmation needs the step-up window or a
  factor (`STEP_UP_REQUIRED`, `FACTOR_NOT_ACCEPTED`), and each id is checked on its own. The
  fixture run is `run_mock_build1`; its DB admin use is Alice's, decided by Carol, another owner.

## Build, test, lint

- Build: `npm run build` (live, to `apps/*/build`) and `npm run build:mock` (to
  `apps/*/build-mock`). Run one locally with `npm run start -w @sneakers-web/staff`.
- Image: `docker build --build-arg APP=<staff|admin> [--build-arg EDGE=mock] .` Add
  `--build-arg DEV_QUICK_LOGIN=true` only for a local stack image (see Dev quick login).
- Test: `npm test`. Server tests run in Node against the mock gateway, with the helpers in
  `@sneakers-web/mock-gateway/testing`: `withMockGateway()` for the file, `sessionCookie(userId)`
  for a signed-in fixture user, and `withCookie(cookie, loader)` to send it with a route's
  requests. Page tests use `createRoutesStub` with the real loaders and actions.
- End to end: `npm run test:e2e` builds and serves both mock builds and runs `e2e/*.spec.ts`
  (sign-in, theme kept across a reload, sign-out, SSO hand-back, each staff screen's flow in
  `e2e/staff-<area>.spec.ts`, and a flow per admin area). CI runs it in the "End to end" job. Set
  `CHROME_PATH` to use an installed Chrome when Playwright's browser isn't downloaded. The servers
  use fixed ports (4176 staff, 4177 admin, 4178 an admin that starts as a fresh install for the
  first-run setup flow) and a run never reuses a server it didn't start, so a
  busy port fails the run at once: two runs on one machine take turns (under `flock`, say).
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
  `ADMIN_URL`. Only the public subset reaches the browser, through the root loader. Local dev
  only: `SNEAKERS_DEV_QUICK_LOGIN` and `SNEAKERS_DEV_QUICK_LOGIN_USERS` (see Dev quick login).

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
- `Secret.canRead` (set by `secret` and `secretsInFolder`): `false` shows the secret locked with a
  way to request access, and `null` means unknown, never readable. A reveal of a secret the user
  can't read is refused with `NO_ACCESS`, and one of a retired secret with `RETIRED` (the
  gateway's `docs/api.md` lists the reasons).
- A check-out isn't a control on reveal: the gateway reveals to anyone with read access, checked
  out or not, so the mock does too. The secret page asks for a check-out first as a workflow aid
  (others see it's in use, and check-in rotates where the type rotates).
