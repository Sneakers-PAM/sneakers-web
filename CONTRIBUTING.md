# Contributing to sneakers-web

This repository follows the Sneakers-PAM workflow in the org
[CONTRIBUTING.md](https://github.com/Sneakers-PAM/.github/blob/main/.github/CONTRIBUTING.md):
issues from a template, a branch per issue, Conventional Commits, squash-merged PRs, and a
[DCO](DCO) sign-off (`git commit -s`) on every commit.

## Working on this repo

- Install with `npm install --ignore-scripts`; see [README.md](README.md) for the dev servers,
  mock builds and image builds.
- `npm run check` runs everything CI runs: lint, typecheck, tests, both builds and the no-mock
  check.
- The typed GraphQL client is generated from the gateway's schemas at the commit pinned in
  `schema-refs.env`; the generated files are committed, the schema copies aren't. Run
  `npm run schema:generate` after bumping the pin.
- Mock mode (`npm run dev:mock`, `*:mock` builds) is build-time only, backed by the in-process
  mock gateway; it never reaches a real gateway, and `npm run check:no-mock` fails a release build
  that carries it.
- Keep the Laces UI kit, the staff app, the admin console and the appliance admin consistent: a
  shared behaviour change lands in the kit, not copied into each app.
- No real names, hosts, addresses or other identifiers in code, tests, fixtures or docs. Use
  example.org, 192.0.2.0/24 and invented names.
