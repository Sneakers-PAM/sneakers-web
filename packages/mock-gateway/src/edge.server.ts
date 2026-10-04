import type { Edge } from "@sneakers-web/api-client";

import { type MockUser, userById, USERS } from "#mock/fixtures/users";
import { mintSession } from "#mock/handlers/auth";
import { MOCK_MARKER } from "#mock/marker";
import { MOCK_GATEWAY_URL, MOCK_SESSION_COOKIE, mockState, SSO_PENDING_ID } from "#mock/state";

/** The banner every screen shows while the app runs against the mock gateway. */
export const MOCK_BANNER = "MOCK DATA, not a real server";

const noteFor = (u: MockUser): string =>
  u.isRoot
    ? "root"
    : u.roles.includes("site-admin")
      ? "site admin"
      : u.roles.includes("recovery")
        ? "recovery role"
        : u.mustEnroll && u.factors.length === 0
          ? "must enrol"
          : "everyday user";

/** Sign in as a fixture user in one step, the way a finished password and code would. */
const quickSignIn = (userId: string) => {
  const u = userById(userId);
  if (!u || u.disabled) return null;
  const enroll = !!u.mustEnroll && u.factors.length === 0;
  const { session, sid } = mintSession(userId, !enroll);
  if (!enroll) session.mfaVerifiedAt = Date.now();
  return {
    cookie: `${MOCK_SESSION_COOKIE}=${sid}; Path=/; HttpOnly; SameSite=Strict; Max-Age=1800`,
    enroll,
  };
};

/**
 * The mock edge: the app server's calls to the gateway are answered in-process from
 * invented fixtures (MSW in Node). Only builds made with `--mode mock` get this module,
 * through the `@sneakers-web/edge.server` alias; no app code imports it.
 */
export const edge: Edge = {
  banner: MOCK_BANNER,
  cookiePrefix: "mock_",
  gatewayUrl: MOCK_GATEWAY_URL,
  mode: "mock",
  quickLogin: {
    signIn: quickSignIn,
    users: () =>
      USERS.filter((u) => !u.disabled).map((u) => ({ id: u.id, label: u.name, note: noteFor(u) })),
  },
  sessionCookie: MOCK_SESSION_COOKIE,
  ssoStart: (origin, base) =>
    `${origin}${base}sign-in?sso_pending=${SSO_PENDING_ID}&factors=totp,email`,
  start: async () => {
    const [{ setupServer }, { handlers }] = await Promise.all([
      import("msw/node"),
      import("#mock/handlers"),
    ]);
    setupServer(...handlers).listen({ onUnhandledFrame: "bypass" });
    // A mock build can start as a fresh install, to walk through first-run setup.
    if (process.env.MOCK_FRESH_INSTALL === "1") mockState.needsSetup = true;
    console.info(`[mock] ${MOCK_MARKER}: gateway calls are answered from fixtures`);
  },
  storagePrefix: "mock:",
};
