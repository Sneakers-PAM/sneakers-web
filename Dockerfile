# syntax=docker/dockerfile:1
# One image per app and edge: APP is staff or admin, EDGE is live (the default) or mock.
# The edge is fixed when the image is built; a running container can't be switched to mock.
#   docker build --build-arg APP=staff -t sneakers-web-staff .
#   docker build --build-arg APP=staff --build-arg EDGE=mock -t sneakers-web-staff-mock .
# VERSION and COMMIT stamp the build that About and diagnostics shows (the package version and
# "unknown" when unset).
# DEV_QUICK_LOGIN=true builds in the dev quick login for a local stack (still off until the
# server sets SNEAKERS_DEV_QUICK_LOGIN=true). DEV_UI_ISSUE_COPY=true builds in the dev-only
# "Copy for UI issue" button the same way (still off until SNEAKERS_DEV_UI_ISSUE_COPY=true).
# Never set either for a release image; check:no-mock keeps both defaults off and proves the
# live build has none of their code.
ARG NODE_IMAGE=node:24-alpine

FROM ${NODE_IMAGE} AS build
ARG APP
ARG EDGE=live
ARG VERSION=""
ARG COMMIT=""
ARG DEV_QUICK_LOGIN=false
ARG DEV_UI_ISSUE_COPY=false
RUN test "$APP" = staff || test "$APP" = admin || { echo "APP must be staff or admin" >&2; exit 1; }
RUN test "$EDGE" = live || test "$EDGE" = mock || { echo "EDGE must be live or mock" >&2; exit 1; }
WORKDIR /src
# Install from the manifests first, so a source change reuses this layer instead of adding a
# new full install to the build cache each time.
COPY package.json package-lock.json ./
COPY apps/staff/package.json apps/staff/
COPY apps/admin/package.json apps/admin/
COPY packages/api-client/package.json packages/api-client/
COPY packages/mock-gateway/package.json packages/mock-gateway/
COPY packages/shell/package.json packages/shell/
COPY packages/ui/package.json packages/ui/
COPY packages/vite-config/package.json packages/vite-config/
RUN --mount=type=cache,target=/root/.npm npm ci --ignore-scripts --no-audit --no-fund
COPY . .
RUN cd "apps/$APP" && if [ "$EDGE" = mock ]; then MODE=mock; else MODE=production; fi \
    && APP_VERSION="$VERSION" APP_COMMIT="$COMMIT" SNEAKERS_DEV_QUICK_LOGIN_BUILD="$DEV_QUICK_LOGIN" \
    SNEAKERS_DEV_UI_ISSUE_COPY_BUILD="$DEV_UI_ISSUE_COPY" \
    APP_BUILD_DIR=build npx react-router build --mode "$MODE"

# Production dependencies only. A live image never gets the mock gateway or msw; a mock image
# adds them, because its server answers gateway calls in-process.
FROM ${NODE_IMAGE} AS deps
ARG APP
ARG EDGE=live
WORKDIR /src
COPY package.json package-lock.json ./
COPY scripts/runtime-deps.mjs scripts/
COPY apps/${APP}/package.json apps/${APP}/
COPY packages/api-client/package.json packages/api-client/
COPY packages/shell/package.json packages/shell/
COPY packages/ui/package.json packages/ui/
COPY packages/mock-gateway/package.json packages/mock-gateway/
RUN --mount=type=cache,target=/tmp/npm-cache node scripts/runtime-deps.mjs "$APP" "$EDGE" \
    && npm install --omit=dev --ignore-scripts --no-audit --no-fund --cache /tmp/npm-cache \
    && rm -rf node_modules/@sneakers-web

FROM ${NODE_IMAGE}
ARG APP
ARG EDGE=live
ENV NODE_ENV=production PORT=3000 SNEAKERS_EDGE=${EDGE}
WORKDIR /app
COPY --from=deps /src/node_modules ./node_modules
COPY --from=build /src/apps/${APP}/build ./build
COPY --from=build /src/apps/${APP}/package.json ./package.json
COPY server/serve.mjs server/app.mjs ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q -O /dev/null "http://127.0.0.1:${PORT}/healthz" || exit 1
CMD ["node", "serve.mjs", "./build/server/index.js"]
