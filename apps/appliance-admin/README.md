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

## Certificates

The Certificates page runs the box's certificate store (`TlsService`): the certificates with
where each is used, the endpoints (:8443 and Product (443)), ACME (Not available yet) and the
status. **Add certificate** is a stepper with three ways in, in this order: Upload PFX (the
certificate, its key and the full chain; the password is write-only), Upload PEM, and a
single-name request made on the box (RSA 4096 by default, no wildcards). Each one validates,
lists every check, then applies to :8443 live. Every change needs an owner and a recent sign-in.
Each endpoint lists the names a certificate is checked against: the box's host name and its
management addresses. When the box has no host name, the page says so and links to Network to set
it, and a refusal for that reason (`TLS_NO_HOSTNAME`) carries the same link. The mock box's states
are `cert-assigned`, `cert-csr-pending`, `cert-expiring`, `cert-no-hostname` and `cert-not-served`
(`?mockScenario=` on a mock build).

## Network

The Network page reads and changes the box's settings (`NetworkService`). An applied change
reverts unless an owner confirms it in time: the pending banner counts down the seconds the box
reports and keeps its Confirm button after a reload, because `GetNetwork` returns the pending
change's token to owner sessions. When a change moves the management address, the banner names
the new URL to sign in at and confirm from; when it changes the name or address, it warns that
the box makes a new certificate. A Confirm that can't reach the box says so, with the seconds
left, rather than the browser's network error. **Run checks** shows each check as OK (green),
Warning (yellow), Failed (red) or Unknown, with its `NET_*` code and detail. Toasts sit at the
bottom centre, clear of the accessibility widget.

## Logs and audit

The Logs page lists the box's audit entries (`AuditService`). The target names the thing acted
on in words (a certificate by its names, a session by its admin and source); the entry's detail
sits under it, with ids and fingerprints in mono. **Export** downloads the whole log as JSON
lines, ids included.

## Review gallery

```sh
CHROME_PATH=/usr/bin/google-chrome npm run gallery:appliance-admin
```

This builds the mock app, serves it the way osadmin does (same `Content-Security-Policy` and
other headers, page routes falling back to `index.html`) and opens it in headless Chrome. It
shoots the signed-out pages, signs in with the dev quick login, then shoots every page in the
frame, at 1280 and 390 px, then the pages again in the mock states a fresh box doesn't show
(`SCENARIOS` and `SIGNED_OUT_SCENARIOS` in `scripts/gallery-appliance-admin.mjs`, such as
Updates with an elevated shell open, each setup step, or Certificates with an assigned, an
expiring or a pending certificate). Each shot waits for the running app's ready marker
(`data-app-ready` on `<html>`, set once the route has rendered and its API calls have
answered), so a build that never starts can't pass.

The run fails on any console error, page error, failed request or CSP violation, and on a
route that never gets ready. The pictures and an `index.html` go to `gallery/` here (ignored by
git), or to `GALLERY_DIR` if set. Leave out `CHROME_PATH` when Playwright's own Chromium is
installed (`npx playwright install chromium`).
