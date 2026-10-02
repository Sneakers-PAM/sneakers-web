#!/usr/bin/env bash
# Regenerates the typed GraphQL clients in packages/api-client/src/generated from the
# gateway schemas pinned in schema-refs.env. The schemas are fetched into .schemas/
# (git-ignored) and never committed; only the generated files are.
#
# SNEAKERS_GATEWAY_SCHEMA_DIR points at a local graphql/ directory instead, for trying an
# unmerged schema change.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=/dev/null
source "$root/schema-refs.env"

dest="$root/.schemas/gateway"
rm -rf "$dest"
mkdir -p "$dest"

if [[ -n "${SNEAKERS_GATEWAY_SCHEMA_DIR:-}" ]]; then
  echo "schema: sneakers-gateway from $SNEAKERS_GATEWAY_SCHEMA_DIR"
  cp "$SNEAKERS_GATEWAY_SCHEMA_DIR"/*.graphqls "$dest/"
else
  echo "schema: sneakers-gateway at $SNEAKERS_GATEWAY_REF"
  curl -sSfL "https://codeload.github.com/Sneakers-PAM/sneakers-gateway/tar.gz/$SNEAKERS_GATEWAY_REF" |
    tar -xz -C "$dest" --strip-components=2 --wildcards '*/graphql/*.graphqls'
fi

for f in schema.graphqls machine.graphqls; do
  [[ -s "$dest/$f" ]] || { echo "schema: $f is missing from the gateway at that ref" >&2; exit 1; }
done

cd "$root/packages/api-client"
npx graphql-codegen --config codegen.ts
# Only the typed documents are used; the preset's string-lookup helper is dropped.
rm -f src/generated/gql.ts src/generated/index.ts
npx prettier --write --log-level warn src/generated
