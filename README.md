# sneakers-web ⚡

> 🧭 Sneakers web apps in one repo: staff, admin, appliance admin, maintenance, docs and the UI kit

The staff app (`/`) and the admin console (`/admin/`) are React Router v7 apps rendered on the
server. Each one is its own Node server and its own container image, and talks to the Sneakers
gateway from the server side; the browser holds only the HttpOnly session cookie.

The appliance admin (`apps/appliance-admin`) is different: a static single-page app (no Node
server) that the sneakers-appliance box's `sneakers-osadmin` serves at `:8443`, talking to its
Connect API directly from the browser. See "Appliance admin" in [AGENTS.md](AGENTS.md).

## 🛠 Develop

```bash
npm install --ignore-scripts
npm run dev             # staff app against the gateway at GATEWAY_URL (default http://localhost:9100)
npm run dev:mock        # staff app against the in-process mock gateway (invented data, banner on)
npm run dev:admin       # admin console; dev:admin:mock for its mock build
npm run dev:appliance-admin:mock   # appliance admin against its in-memory mock transport
npm test                # vitest
npm run lint            # eslint + prettier
npm run typecheck
npm run check           # everything CI runs, including both builds and the no-mock check
```

## 📦 Images

One image per app and edge, built from the repo root:

```bash
docker build --build-arg APP=staff -t sneakers-web-staff .
docker build --build-arg APP=admin --build-arg EDGE=mock -t sneakers-web-admin-mock .
docker build --build-arg APP=staff --build-arg VERSION=v0.1.0 --build-arg COMMIT="$(git rev-parse HEAD)" .
```

`VERSION` and `COMMIT` stamp the build shown under About and diagnostics.

The server listens on `PORT` (3000) and answers `GET /healthz`. Runtime settings: `GATEWAY_URL`,
`TRUST_PROXY`, `APP_ENV`, `LOG_LEVEL`, `LOG_FORMAT`, `SSO_ENABLED`, `STAFF_URL`, `ADMIN_URL`,
`APPLIANCE_BOX_POLLER`. More in [AGENTS.md](AGENTS.md).

On the appliance, set `APPLIANCE_BOX_POLLER=true` on both the staff and the admin app (in
sneakers-release, `env.APPLIANCE_BOX_POLLER: "true"` in the web-staff and web-admin values). Every
page then loads the box's `/_box/poll.js`, so an open tab shows the "rebooting" page while the box
restarts and comes back by itself. Leave it unset on a cluster or hosted install.

For a local stack, `--build-arg DEV_QUICK_LOGIN=true` plus `SNEAKERS_DEV_QUICK_LOGIN=true` and
`SNEAKERS_DEV_QUICK_LOGIN_USERS` (a local file of seeded dev accounts) add a dev quick login to
the sign-in page. The same way, `--build-arg DEV_UI_ISSUE_COPY=true` plus
`SNEAKERS_DEV_UI_ISSUE_COPY=true` add a "Copy for UI issue" item to the account menu. Release
images never set any of them; see "Dev quick login" and "Dev UI issue copy" in
[AGENTS.md](AGENTS.md).

## 🙏 Acknowledgements

Sneakers-PAM was originally written by [@Bugs5382](https://github.com/Bugs5382).

## ⚖️ License

Apache-2.0 (c) 2026 The Sneakers-PAM Authors
