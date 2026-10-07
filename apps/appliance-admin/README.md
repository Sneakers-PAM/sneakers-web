# Appliance admin

The :8443 admin pages for a Sneakers-PAM appliance: a static single-page app that
`sneakers-osadmin` serves on the box, talking to its Connect API from the browser. How it's
built, and the CSP rules it has to follow, are in "Appliance admin" in the repo's
[AGENTS.md](../../AGENTS.md).

## Run it

```sh
npm run dev:appliance-admin:mock   # against the in-memory mock, http://localhost:5180
npm run build -w @sneakers-web/appliance-admin   # the live build, in build/client
```

## Review gallery

```sh
CHROME_PATH=/usr/bin/google-chrome npm run gallery:appliance-admin
```

This builds the mock app, serves it the way osadmin does (same `Content-Security-Policy` and
other headers, page routes falling back to `index.html`) and opens it in headless Chrome. It
shoots the signed-out pages, signs in with the dev quick login, then shoots every page in the
frame, at 1280 and 390 px. Each shot waits for the running app's ready marker
(`data-app-ready` on `<html>`, set once the route has rendered and its API calls have
answered), so a build that never starts can't pass.

The run fails on any console error, page error, failed request or CSP violation, and on a
route that never gets ready. The pictures and an `index.html` go to `gallery/` here (ignored by
git), or to `GALLERY_DIR` if set. Leave out `CHROME_PATH` when Playwright's own Chromium is
installed (`npx playwright install chromium`).
