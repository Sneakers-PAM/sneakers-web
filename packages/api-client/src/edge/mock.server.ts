import type { Edge } from "#api/edge/types";

import { MOCK_MARKER } from "#api/edge/mockMarker";

/** The banner every screen shows while the app runs against the mock gateway. */
export const MOCK_BANNER = "MOCK DATA, not a real server";

const SESSION_COOKIE = "mock_sneakers_sid";
const SSO_PENDING_ID = "mock-pending-sso";

const gatewayUrl = process.env.MOCK_GATEWAY_URL || "http://127.0.0.1:5171";

/**
 * The mock edge: the app server calls the standalone mock server (Sneakers-PAM/sneakers-mock-server).
 * Only builds made with `--mode mock` get this module, through the `@sneakers-web/edge.server`
 * alias; no app code imports it.
 */
export const edge: Edge = {
  banner: MOCK_BANNER,
  cookiePrefix: "mock_",
  gatewayUrl,
  mode: "mock",
  quickLogin: {
    signIn: async (personId) => {
      const answer = await fetch(`${gatewayUrl}/_mock/controls`, {
        body: JSON.stringify({ kind: "sign-in", personId }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      if (!answer.ok) return null;
      const { cookie, enroll } = (await answer.json()) as { cookie: string; enroll: boolean };
      return { cookie: `${cookie}; Path=/; HttpOnly; SameSite=Strict; Max-Age=1800`, enroll };
    },
    users: async () => {
      const answer = await fetch(`${gatewayUrl}/_mock/people`);
      const people = (await answer.json()) as {
        disabled?: boolean;
        id: string;
        name: string;
        note: string;
      }[];
      return people
        .filter((p) => !p.disabled)
        .map(({ id, name, note }) => ({ id, label: name, note }));
    },
  },
  sessionCookie: SESSION_COOKIE,
  ssoStart: (origin, base) =>
    `${origin}${base}sign-in?sso_pending=${SSO_PENDING_ID}&factors=totp,email`,
  start: async () => {
    const answer = await fetch(`${gatewayUrl}/_mock/controls`).catch(() => null);
    if (!answer?.ok) {
      throw new Error(`no mock server at ${gatewayUrl}: start one with npm run mock`);
    }
    const { sessionCookie } = (await answer.json()) as { sessionCookie: string };
    if (sessionCookie !== SESSION_COOKIE) {
      throw new Error(
        `the mock server at ${gatewayUrl} uses ${sessionCookie}: start it with npm run mock`,
      );
    }
    console.info(`[mock] ${MOCK_MARKER}: gateway calls go to ${gatewayUrl}`);
  },
  storagePrefix: "mock:",
};
