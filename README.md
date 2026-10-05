# sneakers-web ⚡

> 🧭 Sneakers web apps in one repo: staff, admin, appliance admin, maintenance, docs and the UI kit

The staff app (`/`) and the admin console (`/admin/`) are React Router v7 apps rendered on the
server. Each one is its own Node server and its own container image, and talks to the Sneakers
gateway from the server side; the browser holds only the HttpOnly session cookie.

## 🛠 Develop

```bash
npm install --ignore-scripts
npm run dev             # staff app against the gateway at GATEWAY_URL (default http://localhost:9100)
npm run dev:mock        # staff app against the in-process mock gateway (invented data, banner on)
npm run dev:admin       # admin console; dev:admin:mock for its mock build
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
`TRUST_PROXY`, `APP_ENV`, `LOG_LEVEL`, `LOG_FORMAT`, `SSO_ENABLED`, `STAFF_URL`, `ADMIN_URL`. More in
[AGENTS.md](AGENTS.md).

## 🙏 Acknowledgements

Sneakers-PAM was originally written by [@Bugs5382](https://github.com/Bugs5382).

## ⚖️ License

Apache-2.0 (c) 2026 The Sneakers-PAM Authors
