# AGENTS.md - sneakers-web

Guide for AI agents working in this repository. Pair with `CLAUDE.md` (the working agreement and
hook-enforced rules). Keep this file current when the build, layout, or public API changes.

## What this is

Sneakers web apps in one repo: staff, admin, appliance admin, maintenance, docs and the UI kit.
Today it ships three apps. The staff app (`apps/staff`, served at `/`) and the admin console
(`apps/admin`, served at `/admin/`) are React Router v7 framework-mode apps rendered on the
server (SSR), each built into its own Node server and container image. The appliance admin
(`apps/appliance-admin`) is architecturally different: a React Router v7 SPA (`ssr: false`,
no Node server at all), built to static assets and served, at `/`, by `sneakers-osadmin` in the
sneakers-appliance repo's root image -- see "Appliance admin" below before touching it.

Before changing anything in the staff or admin apps, know two things:

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

## Appliance admin (apps/appliance-admin)

The :8443 appliance admin front end for sneakers-appliance's OS and appliance layer (upgrades,
network, access, backups, MCP, power), not the Sneakers application itself. It is deliberately
minimal -- plain forms and big obvious actions, the bar of an Infoblox or router admin UI -- and
built only from `packages/ui` and `packages/shell` pieces; no new design-system components.

- **Static SPA, no server.** `react-router.config.ts` sets `ssr: false`, so `react-router build`
  writes only `build/client` (no `build/server`), and `entry.server.tsx` runs once at build time
  to prerender the SPA fallback shell -- it never runs at request time. It re-exports the shell's
  streaming `handleRequest` (which waits for the whole render in SPA mode): `renderToString`
  can't write the script that closes React Router's hydration stream, and without it the page
  never hydrates. There is no Dockerfile
  target for this app in this repo; its build output is consumed by sneakers-appliance, which
  pins it by digest in `release.yaml` and bakes it into the root image.
- **No gateway, no GraphQL.** The browser calls `sneakers-osadmin`'s Connect API (gRPC-compatible
  JSON over HTTP) directly, same origin: `POST /sneakers.appliance.osadmin.v1.<Service>/<Method>`,
  plus `POST /upload` (a `.bin` body) and `GET /export/audit-log`. `app/lib/osadmin/client.ts` is
  a thin, hand-written wrapper (there is no generated Connect-ES client yet) over
  `app/lib/osadmin/types.ts`, which mirrors the protos in sneakers-appliance's
  `proto/sneakers/appliance/osadmin/v1/*.proto`.
- **Answers come with fields left out.** osadmin answers through connect-go's protojson codec,
  which leaves out every field at its zero value: an empty list or map, `""`, `0`, `false` and an
  enum's `*_UNSPECIFIED` (an admin with no SSH keys has no `keys`). Every `client.ts` call that
  returns fields passes its answer through a function in `app/lib/osadmin/wire.ts`, which puts the
  defaults back, so the rest of the app can trust `types.ts`. Each function takes `Wire<T>` (the
  answer with every field optional, at every depth) and returns `T`, so the compiler names any
  required field left without a default. A new RPC with fields gets its function there.
  `app/routes/protojson.test.tsx` renders every route in `app/routes.ts` against the mock's
  answers shaped the way protojson sends them: as they are, with the lists inside list items
  emptied, and with every list emptied.
- **Strict CSP, no inline anything.** `sneakers-osadmin` sets the header on every :8443 response
  (`SecurityHeaders` in sneakers-appliance's `internal/osadmin/server.go`):
  `default-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'`, with no
  `unsafe-inline`, `unsafe-eval` or hashes. So the build keeps every script and style in a file:
  - React Router's SPA prerender writes its bootstrap and hydration data as inline scripts; the
    `buildEnd` hook in `react-router.config.ts` moves each one to `assets/inline-<sha256>.js`
    and points the tag at it (`app/csp/inline.ts`), in the same order. It drops `async` from
    the module script: React treats `<script async src>` as a hoisted resource and the page
    would fail to hydrate.
  - sonner (the toasts) inserts its CSS as a runtime `<style>`; a Vite plugin
    (`app/csp/sonnerStyles.ts`) drops that insert and `app/app.css` imports
    `sonner/dist/styles.css` instead.
  - Radix's select viewport renders an inline `<style>`; `app/csp/radixStyles.ts` replaces it
    with nothing and `app/csp/radix.css` ships the same rules.
  - Radix's scroll lock (react-remove-scroll) adds a `<style>` while a dialog, select or menu is
    open; `app/csp/styleSingletonPlugin.ts` swaps react-style-singleton's singleton for
    `app/csp/styleSingleton.ts`, which uses a constructed stylesheet instead.
  - Each of these plugins fails the build if the package changes so the swap no longer applies.
  - The shell's `Document` leaves the `--text-scale` style attribute off at the default size,
    so the prerendered `<html>` carries none. The stylesheet link in `root.tsx` has a
    `precedence`, so React hoists it and the prerendered `<head>` hydrates.
  - `npm run check:csp` (in `npm run check` and the Test workflow) fails if a built page, live
    or mock, has an inline script or style, a style or event handler attribute, a `javascript:`
    URL or a resource from another origin. It reads HTML only, so runtime injection is the
    browser's job: `e2e/appliance-csp.spec.ts` (the `appliance-csp` Playwright project, in
    `npm run test:e2e`) serves the live build with osadmin's headers
    (`e2e/applianceAdminServer.mjs`) in Chrome, and checks the sign-in page renders, runs and
    logs no CSP violation. Run it alone with `npx playwright test --project appliance-csp`.
- **Review gallery.** `npm run gallery:appliance-admin` shoots every route of the running mock
  build, served with osadmin's headers, in headless Chrome; see `apps/appliance-admin/README.md`.
  The app sets `data-app-ready="<pathname>"` on `<html>` once a route has rendered and every API
  call it made has answered (`app/lib/readiness.ts`, counted in `app/lib/osadmin/client.ts`).
- **Its own edge, not `@sneakers-web/edge.server`.** `app/lib/edge.live.ts` (real `fetch`) and
  `app/mock/edge.mock.ts` (an in-memory fake, no MSW and no service worker, since there's no
  server process to intercept) both implement `app/lib/osadmin/edgeTypes.ts`'s `Edge` interface.
  The Vite alias `@sneakers-web/edge` picks one by build mode, same idea as the rest of the repo,
  different mechanics because this app has no server half to swap. Tests always get the mock
  edge (`vitest.config.ts`); `app/mock/world.ts` holds the fixture admins, keys and settings,
  and `resetMockWorld()` (called from `app/test/setup.ts` after every test) puts them back.
- **Sessions live in memory, not a readable cookie.** `__Host-osadmin-session` is `HttpOnly`;
  the browser never reads it. `app/lib/osadmin/sessionStore.ts` holds the `Session` the last
  `SignIn`, `StepUp` or `GetSession` call returned (admin, role, root operator, CSRF token,
  step-up expiry), and
  `app/frame/AppFrame.tsx` calls `GetSession` once on mount to find out whether the box still
  knows this browser.
- **Sign-in (`app/routes/sign-in.tsx`).** The admin's name, password and a 6-digit code from
  their authenticator (`SignInService.SignIn`). A refusal carries a `SignInRefusal` error
  detail; `refusalOf` (`app/lib/osadmin/errors.ts`) reads it from the detail's JSON `debug`
  form or, failing that, decodes its binary value, and `refusalMessage`
  (`app/lib/osadmin/refusal.ts`) turns it into one sentence: the tries left, the lockout's
  end ("until an owner unlocks it" in that lockout mode) or this address's wait. The page
  links to `/setup` for a setup or invitation code.
- **Setup (`app/routes/setup.tsx`, steps in `app/features/setup/`).** Six steps with a progress
  line: 1 the console's setup code (16 Crockford base32 characters, `XXXX-XXXX-XXXX-XXXX`, valid for
  60 minutes; case, dashes and spaces don't matter, and the page only asks for it, never shows
  it; `RedeemCode` sets a code session cookie), 2 the first
  admin's name and password, checked as it's typed (`CheckPassword`), then the authenticator
  (`BeginCredentials` gives the secret for the QR code and the typed key,
  `CompleteCredentials` checks a code from it and signs the browser in), 3 the recovery keys
  and the escrow (each key either made on the box, "Generate one here", `GenerateRecoveryKey`,
  whose private key the browser downloads once and the box never keeps, or "Provide your own", a
  pasted public key, `AddRecoveryKey`), 4 the network (read only, `AcknowledgeStep`), 5 the protection (read only),
  6 one sign-in with the password and a code, the single-admin warning, and `Finish`. The box
  restarts into normal operation after Finish, so the page shows the restart page and offers
  Updates and Status (full page loads, signing in again) only once the box answers; a Finish
  whose answer is lost to the restart counts as finished. A reload
  asks `GetSession` and `GetSetup` and resumes at `current`, the box's first step not done.
  The same page takes an invitation or a Recover access code (`codeKind`), and then shows only
  the password and authenticator. Until the admin is signed in, the code session's calls carry
  the redeemed code's CSRF token (`RedeemCodeResponse.csrfToken`, kept in sessionStorage so a
  reload can finish; `sessionStore.csrfToken()`), then the session's own. There are no one-time recovery codes: a lost authenticator
  is reset by an owner, or through Recover access on the console.
- **The setup phase (`app/lib/phase.ts`).** `StatusService.GetPhase` is public and answers
  `firstboot` until setup's Finish, then `normal`; once normal it is kept for the page's life.
  The root `clientLoader` (`app/root.tsx`) redirects every path but `/setup` to `/setup` while the
  box says `firstboot`, and `shouldRevalidate` reruns it on every navigation until the box says
  `normal`, so neither a typed URL nor a link reaches sign-in before setup (sneakers-osadmin
  redirects the page loads too). When the box doesn't answer the page is shown as it is. After
  setup `/setup` never shows the stepper: an anonymous visitor gets only the invitation or Recover
  access code form (`CodeStep afterSetup`), and the box refuses the setup-only calls anyway
  (`SETUP_DONE`).
- **One step-up dialog for every page.** A mutating call that answers
  `ACCESS_STEPUP_REQUIRED` (Connect `permission_denied`) doesn't build its own prompt; it calls
  `requestStepUp` (`app/lib/osadmin/stepUpController.ts`) through `runAction`
  (`app/lib/osadmin/action.ts`), which queues the retry behind the one `<StepUpDialog>` mounted
  in `AppFrame`. The dialog asks for a fresh TOTP code (`SignInService.StepUp`), keeps a
  refusal in place, and retries the action once the box takes the code. A Connect `unimplemented` (a page's backend isn't on the box yet) becomes "Not
  available in this release" (`app/components/NotAvailable.tsx`); the Updates page shows it in
  full when `GetUpgrades` answers that way.
- **Updates (`app/routes/updates.tsx`).** One flow for both targets: the base image (its slots
  and a reboot) and the product bundle (k0s, its images and Sneakers-PAM, in their own slots,
  with no reboot). The Product card shows the installed, staged and previous product versions
  (`GetUpgrades.product`; hidden when a box from before product bundles leaves it out), with
  Install product (`ApplyUpdate{target: PRODUCT}`, after the version is typed) and Revert
  product (`RevertUpdate{target: PRODUCT}`). The Install card lists the product versions that
  fit the running base (`ListProductVersions`, newest first): pick one and Fetch it, then
  Verify and stage as for a base `.bin`. An air-gapped box (`UPGRADE_AIR_GAPPED`: no mirror and
  direct fetches off) uploads the product bundle instead. Owners can allow direct fetches from
  the release source (`UpgradePolicy.direct`) on a build that has one (`directAvailable`).
  Owners upload a `.bin` (`edge.upload`, an
  `XMLHttpRequest` because only XHR reports upload progress; `/upload` answers errors as plain
  text) or fetch one from the mirror, which is hidden on an air-gapped box (no mirror set).
  `UpgradeService.StageUpdate` is one call that verifies the signature, channel and hash and only
  then unpacks and stages, so the page shows "Verifying" while it runs, with the update's steps
  (`GetUpgrades.upgradeProgress`, asked for each second while it runs; `app/components/UpgradeSteps.tsx`:
  each step done, now, to come or failed, the current one with its detail and, while the release
  is written into the slot, a progress bar of the bytes), then either a green
  "Verified" panel (file, version, architecture, signature, channel, SHA-256 with Copy, and the
  slot it went into, `StageUpdateResponse.slot`) or the refusal's reason in place (never a toast).
  Every state of the file shows in that one panel (`ResultPanel`, `aria-label="Verify result"`,
  its tone in `data-tone`): info while uploading, received or verifying, amber while a stage
  waits for the step-up code, red with the reason and error code for a refused upload, fetch,
  verify or stage, or a cancelled step-up (which keeps the upload, so it can be verified again).
  The Base system card reads the other slot from `GetUpgrades`: "staged <version>", the release
  kept for a revert (`previousVersion`, "Other slot: 0.0.9 (revert target)"), or "empty" only
  when there's neither; Revert is offered, as "Revert to <version>", only when there's a revert
  target. Status says the same, and the diagnostics' slot line names it ("0.0.9 in the other
  slot (B) for a revert", from `previousSlot`). Staging a base update writes over the other
  slot, so the release there goes at the stage, not the apply: the Install an update card says
  "Staging a base update removes <version> and its files." and the panel's Verify and stage step
  (received, or a refused stage it can retry) says "This removes <version> and its files.", both
  from `GetUpgrades.nextStageRemoves`; a product bundle's stage names no base release. Apply, Revert, Install product and
  Revert product each need the version typed (the running one for a base revert) and a fresh
  authenticator code in the same dialog, every time (`totpCode`; the box checks it on every call,
  not the step-up window), and a refused code stays in the dialog with the tries left. Stage and
  the update window are owner and step-up. Admins see the state only. A base apply or revert
  swaps the page for the shared restart page (`app/components/BoxRestarting.tsx`): it waits for
  the box to go down, asks the public `GetPhase` every 2 seconds (no answer: down), then
  `GetSession`, until :8443 answers without the old session (sessions don't survive a restart;
  `app/lib/osadmin/restart.ts`), then loads the
  sign-in page in full, on a new TLS session. After 10 minutes it offers a reload, which is how
  the browser gets to check a certificate that changed. After an apply or a revert it lists the
  update's steps, seeded from `GetUpgrades` as the apply returns and then from the public
  `GetPhase.upgradeProgress` (the steps alone): rebooting while the box is down, then checking
  health and marking good once :8443 answers, and it goes to sign-in only when they're done. A
  failed step stops it there ("The update didn't finish", the step marked failed) with a Sign in
  button. Outside a stage, an update under way (the window's, say) or the last one that failed
  shows its steps in the "Update progress" card, and the page asks for them each second while one
  runs.
  While an elevated shell is open (`GetUpgrades.activeElevations`) the page names who holds it,
  and an apply or revert the box refuses with `UPGRADE_ELEVATED` stays on the page with the
  holder. From there an owner can end the shell: the override dialog takes a reason and the
  session's admin and id typed (`bob E-9M4T`) and a fresh code, and sends them as
  `elevationOverride` on the same Apply or Revert; the box ends the session, audited, before the update goes ahead. A refusal of
  the override stays in the dialog.
- **Access (`app/routes/access.tsx`, parts in `app/features/access/`).** The admins, each with
  the role, a root-operator badge, the sign-in state (active, locked until when or until an
  owner unlocks, an open invitation) and the issued SSH keys. Owners unlock (`UnlockAdmin`),
  re-invite (`ReinviteAdmin`: the password and authenticator are cleared and a new code is
  shown) and remove admins. Remove admin shows, disabled with the reason next to it
  (`app/features/access/removeBlocked.ts`), on your own row ("You can't remove your own account.
  Another owner can.") and on the last owner's ("At least one owner must remain", the box's
  `ACCESS_LAST_OWNER`); a refusal the box still sends stays above the list, not a toast. Add admin (`AddAdmin`, optionally a root operator) shows the
  one-time invitation code the new admin types on `/setup`. Your account: change the password
  (`ChangePassword`, checked as it's typed), replace the authenticator
  (`Begin`/`CompleteTotpReplacement`), and "Get an SSH key" (`IssueSshKey`): the dialog takes a label and a
  fresh authenticator code every time (`totpCode`; the box checks it on every call, not the
  step-up window, and a refused code stays in the dialog with the tries left), the box makes the
  key pair and signs it with its root key, and the dialog shows the private key once, with
  downloads for the key and its `-cert.pub` certificate; SSH asks for the TOTP code after
  login. Owners set the access settings (`SetAccessPolicy`: the lockout mode, the root-shell
  code and session minutes, 10 by default, and the SSH key validity) and the root-operator
  roster (`SetQuorum`; the same roster approves a factory reset). The page also lists the
  revoked login keys (`ListAdmins.revokedKeys`: whose key it was, the fingerprint, the type,
  when and who revoked it, `unknown` when the box didn't record it; owners un-revoke behind a
  confirmation dialog), the root key's and the host keys' fingerprints, and the root shells
  (`ListElevations`; an owner ends an open one). Owner-approved elevation and adding a key an
  admin brings are gone.
- **Root shell (`app/routes/root-shell.tsx`).** Root operators only (`Session.rootOperator`; the
  nav item shows only for them). The admin pastes the challenge their SSH menu shows and a fresh
  TOTP code (`RootShellService.IssueRootShellCode`), and the page shows the one-use code with
  its expiry (a countdown), the root shell's time limit, and the SSH address the challenge came
  from, to check. A refusal stays on the page.
- **Factory reset (`app/routes/power.tsx`).** Owner only, after typing the box's host name; not
  offered when `GetPower` says it's unavailable (a single admin), with the reason. A request shows
  M of N and each roster member's approval; a member who hasn't approved gets Approve (the server
  refuses a second approval from the same admin, `RESET_APPROVED`). Once the quorum is in,
  `app/components/ResetCountdown.tsx` shows the 10-minute countdown with the one big Cancel any
  admin may press, on Power and on Status. Both pages re-read every 5 seconds while a reset is in
  progress.
- **Mock scenarios.** `applyMockScenario` (`app/mock/edge.mock.ts`), or `?mockScenario=a,b` on a
  mock build's URL, puts the mock box into a state for the tests and the review screen list:
  `air-gapped`, `staged`, `no-previous` (nothing in the other slot; by default 0.0.9 is kept
  there for a revert), `failed` (boot counting fell back from 0.2.0), `reverted` (alice
  reverted from 0.2.0; Status and Updates say "Reverted from", not "Failed"), `manual`, `no-product` (before the first product
  install), `status-fails` (Status answers unavailable, as while accessd isn't answering), `product-staged` (0.2.0 staged, 0.0.9 in the previous slot; a product install or revert restarts the product services, stopped for two GetUpgrades, then running), `product-restart-fails` (that restart's step fails instead), `elevated` (bob has an elevated shell open, so
  Apply and Revert are refused without an owner's override), `uploading` and `verifying` (the upload or the
  verification never finishes), `stepup` (the next step-up-gated call is refused once, so the
  dialog asks for a code), `locked`, `locked-until-unlocked` (bob is locked out, for 12
  minutes or until an owner unlocks him), `throttled` (this address has to wait), `first-boot` (no admin yet; the setup code is
  `MOCK_SETUP_CODE`), `setup-admin`, `setup-keys`, `setup-network`, `setup-protection` and
  `setup-finish` (setup part-way, as a reload finds it), `reduced` (no Secure Boot, no TPM),
  `invited` (carol's invitation, `MOCK_INVITE_CODE`), `signed-in` (the box still knows this
  browser), `single-admin`, `reset-pending` and
  `reset-countdown`. The mock verifies an upload by its content: one containing "tampered" fails
  the signature, "lab" the channel, and "patch" is a patch for the running version. A key removed
  in the mock lands on its revoked list as revoked by the signed-in admin, as on the box, and the
  world starts with one key alice revoked. Every mock admin's password is `MOCK_PASSWORD`
  (`app/mock/world.ts`), any 6-digit code but `000000` passes as their TOTP code, and 3 wrong
  tries lock the admin for 15 minutes, as on the box.
- **Advanced disclosure.** The trust/PKI details on Certificates, the whole Add-on modules page
  and the Logs page's support bundle sit behind `app/components/Advanced.tsx`, a plain
  `<details>` -- no new kit component needed for a collapsed-by-default section.
- **Dev quick login is mock-only.** There's no local dev server talking to a real gateway to
  gate a second way (unlike staff/admin's build-flag variant): `edge.quickLogin` only exists on
  the mock edge, and the sign-in page only renders the control when `edge.mode === "mock"`.

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

## Dev SSO

The chart leaves `SSO_ENABLED` off by default, so "Sign in with SSO" never shows on a live
install until an admin wires up a real identity provider. The same switches as the dev quick
login (`SNEAKERS_DEV_QUICK_LOGIN_BUILD` at build time, `SNEAKERS_DEV_QUICK_LOGIN` and
`SNEAKERS_DEV_QUICK_LOGIN_USERS` at run time) also show the button and simulate the hand-back:
with no real identity provider to redirect to, posting the `sso` intent signs in as the first
account in the users file instead, through the same password step as a real login. A mock
build's `ssoStart` already does the equivalent with a fixture user, so this only matters for a
live build. Nothing new to turn on: the same `check:no-mock` run that proves the dev quick
login never ships proves this doesn't either (`packages/shell/src/server/signIn.server.ts`).

## Dev UI issue copy

A "Copy for UI issue" item (DEV badge) in the account menu of both apps copies a compact,
machine-readable bundle describing the current screen, for pasting into an issue or a chat
when reporting a UI problem. It is smaller than About and diagnostics' report and is meant to
be read by tools, not people. It never ships in a release.

- Same two switches as the dev quick login. At build time: the dev server (`npm run dev`)
  always has it, and a production build only with `SNEAKERS_DEV_UI_ISSUE_COPY_BUILD=true` (the
  image's `DEV_UI_ISSUE_COPY=true` build argument, for a local stack). At run time: the server
  also needs `SNEAKERS_DEV_UI_ISSUE_COPY=true`. Both switches gate the button in
  `packages/shell/src/issueCopy/IssueCopyMenuItem.tsx`; the root loader checks both and hands
  the result to the browser as `developmentUiIssueCopy` (`RootData`,
  `packages/shell/src/server/root.server.ts`) -- kept out of `PublicConfig` so the server
  variable's name never appears unconditionally in a live build.
- Release builds can't turn it on: the build flag is a literal, so a release build drops the
  code, and `check:no-mock` fails if a live build (`apps/*/build`) has the button's text, the
  `SNEAKERS_DEV_UI_ISSUE_COPY` variable name or the item's `data-issue-copy` marker
  (`ISSUE_COPY_MARKER`), or if the Dockerfile's `DEV_UI_ISSUE_COPY` argument defaults to
  anything but `false`. The mounted item renders the marker, and the check refuses to run if
  the component stops doing so, so the tell can't go stale. The chart sets none of it.
- A ring buffer (`packages/shell/src/issueCopy/errorBuffer.ts`) keeps the last render, fetch,
  window and unhandled-rejection error, capped at 5, and the last clicked element (its
  `data-testid`, or otherwise a short CSS selector -- never its text; clicks on the copy item
  itself are ignored). A failure to record a fetch error never replaces the caller's error.
  It's only installed
  while both switches are on (`AppRoot`, `packages/shell/src/root/Document.tsx`); a render
  error is recorded from the shared error boundary (`RouteError.tsx`).
- `packages/shell/src/issueCopy/bundle.ts` builds the bundle and copies it as one minified
  line of JSON. Every string goes through the same redaction as the logger (`scrub`,
  `packages/shell/src/diagnostics/report.ts`), and a key with nothing to say is left out,
  never set to null.
- Every error message goes through one choke point, `redactIssueText`
  (`packages/shell/src/issueCopy/redact.ts`), before it's cut to 200 characters. On top of
  the logger's patterns, it replaces:
  - PEM blocks, terminated or not, with `[pem]`;
  - URL userinfo with `scheme://[host]`, and drops URL fragments;
  - emails with `[email]`;
  - access key ids, cookie-style `key=value` values of 8 or more characters, and base64 or
    hex runs of 24 or more, with `[redacted]`;
  - IPv4 and IPv6 addresses with `[ip]`, and host names (two labels or more, ending in a
    network TLD) with `[host]`.

### Bundle format (schema v1)

The shared reference for every product's web repo: keep the keys and their order identical.

| Key                 | Type               | Meaning                                                                                                                                   |
| ------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `v`                 | int                | Schema version, `1`.                                                                                                                      |
| `product`           | string             | `"sneakers"`.                                                                                                                             |
| `app`               | string             | The app name (`staff` or `admin`).                                                                                                        |
| `sha`               | string             | The commit the build came from (`__APP_COMMIT__`: `APP_COMMIT`, else `GITHUB_SHA`, else `"unknown"`).                                     |
| `route`             | string             | The router route id (`useMatches().at(-1)?.id`).                                                                                          |
| `path`              | string             | The route pattern, not the concrete URL (e.g. `/secret/:id`). An unmatched URL is `"*"`.                                                  |
| `params`            | object             | Route params (`useParams()`), kept only when the value is a ULID or a UUID; anything else is dropped.                                     |
| `role`              | string             | The signed-in user's role (`"root"` or the first of `roles`). No username, display name or email.                                         |
| `vw` / `vh` / `dpr` | int / int / number | Viewport width and height in CSS px, and the device pixel ratio.                                                                          |
| `ua`                | string             | `navigator.userAgent`.                                                                                                                    |
| `t`                 | string             | The copy time as ISO 8601 with the US Eastern offset.                                                                                     |
| `theme` / `locale`  | string             | The active theme (`useDisplay().settings.theme`) and locale (`navigator.language`).                                                       |
| `clicked`           | string             | The last clicked element: its `data-testid` when it has one, otherwise a short CSS selector. Never its text content.                      |
| `lastErr`           | object             | The most recent client-side error: `m` (message, at most 200 chars), `src` (`render`, `fetch`, `window` or `promise`) and `at` (ET time). |
| `recentErrors`      | array              | Up to 4 earlier errors in the same shape, newest first (the ring buffer holds 5 in total; `lastErr` is the newest).                       |

Never included: secret values, tokens, cookies, headers, query strings, form contents,
usernames, display names or emails.

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
  `@sneakers-web/shell/server`). `layout/AppShell.tsx` is the frame both apps render into: a
  fixed sidebar rail only from a genuinely wide desktop (`min-width: 1440px`); everything
  narrower, including an iPad Pro 13 (1024 or 1366 wide, which `useBreakpoint` itself still calls
  "desktop"), gets the same drawer a phone does.
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

Each readable row in the browse grid (`features/browse/SecretsTable`) gets quick-copy buttons and
matching context-menu entries for its type's primary fields (`quickCopy.primaryFieldsOf`: the
identity field, plus the required sensitive field or the first sensitive field when none is
required). `useQuickCopy` copies the identity field straight from the secret's own loader data
(a plain field, never revealed or audited, same as the secret page's `Plain` fields), and the
sensitive one through the same audited `intent: "reveal", purpose: "copy"` the secret page posts
to that secret's route, so the vault's step-up and super-sensitive rules still apply without
opening the secret.

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

## Break-the-glass mode

- Site admins (and root) get a "Break glass" header button and account-menu item in the staff
  app; nobody else sees it, and `/break-glass` is a 404 for them. It's the web app only: the
  gateway refuses personal tokens and service accounts (`BREAK_GLASS_WEB_ONLY`).
- `/break-glass` (`routes/break-glass.tsx`, `features/breakGlass/`) asks for a reason and an
  authenticator code (`openBreakGlassSession`; no approver). With a session open it lists every
  folder, other people's personal ones included, and each folder's secrets
  (`breakGlassBrowse`). A reveal there is `breakGlassSecret` with the `sessionId`: a fresh code
  each time, the dialog says the owners will be notified, and the fields show in the red
  break-glass card. It grants no edit rights; the page has no edit controls.
- While a session is open, `BreakGlassBanner` (`packages/shell/src/layout/BreakGlassBanner.tsx`)
  shows on every page of both apps, from `frameData`'s `breakGlass` (the `breakGlassSession`
  query, asked only for admins; a failure reads as off). Its Exit posts to each app's
  `resources/break-glass` route (`breakGlassExitAction`), which ends the session and goes to the
  app's start. At the session's expiry (15 minutes) the banner reloads the page's data, so the
  normal app returns; a page that finds the session closed (`BREAK_GLASS_SESSION_CLOSED`) shows
  the open form again.
- The admin console's audit page shows each session as one "Entered break-glass" and one "Left
  break-glass" entry (`breakGlassSessions`), and "Show N secrets revealed" lists who saw what.
- The mock gateway (`handlers/staff/breakGlass.ts`, state in `mockBreakGlass`) follows the same
  rules: site admins only, a session bound to the mock web session, 15 minutes, one open session
  per admin (a new one replaces it), and each reveal recorded under the session.

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
- An app with no `resources/diagnostics` gives its own copier through `DiagnosticsCopierProvider`;
  every `CopyDiagnostics` below it, the crash, offline and not-found screens included, calls it
  instead of asking the app server. The appliance admin does this in `root.tsx` (its page and its
  error boundary): `copyApplianceDiagnostics` (`app/lib/diagnostics/copy.ts`) copies its own
  report (this build, the signed-in admin, the box and its service health, no gateway) with the
  page, the problem, the time and the browser added. On the box, the build is stamped by
  sneakers-appliance's `build/lab/pages.sh`. When Status can't be read, About, the copied text
  and the JSON keep why (`boxError`: the Connect code and message, or `unknown` with the
  message for an error that isn't the box's), as "Box: couldn't be read (unavailable: ...)",
  and About offers Retry.

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
  `--build-arg DEV_QUICK_LOGIN=true` and `--build-arg DEV_UI_ISSUE_COPY=true` only for a local
  stack image (see Dev quick login and Dev UI issue copy).
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
  only: `SNEAKERS_DEV_QUICK_LOGIN` and `SNEAKERS_DEV_QUICK_LOGIN_USERS` (see Dev quick login),
  and `SNEAKERS_DEV_UI_ISSUE_COPY` (see Dev UI issue copy).

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
