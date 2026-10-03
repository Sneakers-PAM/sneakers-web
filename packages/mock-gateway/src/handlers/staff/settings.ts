import { http, HttpResponse, type RequestHandler } from "msw";

import {
  factorsOf,
  hasFactor,
  isLastEnforcedFactor,
  removeFactor,
} from "#mock/fixtures/staff/settings";
import { sessionOf } from "#mock/handlers/auth";
import { freshMfa } from "#mock/handlers/stepUp";
import { MOCK_GATEWAY_URL, MOCK_SESSION_COOKIE, type MockSession, mockState } from "#mock/state";

const at = (path: string) => `${MOCK_GATEWAY_URL}${path}`;
const refuse = (status: number, error: string, headers?: HeadersInit) =>
  HttpResponse.json({ error } as never, { headers, status });

/** The gateway's authedSession: the cookie, then the CSRF double-submit. */
const authedOr = (request: Request): MockSession | Response => {
  const s = sessionOf(request);
  if (!s) return refuse(401, "no_session");
  if (request.headers.get("X-CSRF-Token") !== s.csrf) return refuse(403, "csrf");
  return s;
};

const endSession = (s: MockSession) => {
  for (const [sid, session] of mockState.sessions) {
    if (session === s) mockState.sessions.delete(sid);
  }
};

/** Mock answers for the signed-in user's own sign-in methods (the staff Security page). */
export const settingsHandlers: RequestHandler[] = [
  http.get(at("/auth/mfa/factors"), ({ request }) => {
    const s = authedOr(request);
    if (s instanceof Response) return s;
    return HttpResponse.json({ factors: factorsOf(s.userId) });
  }),

  // Self-service removal covers the authenticator app only, and ends the session the way
  // sign-out does, so the next sign-in sets a new one up.
  http.post(at("/auth/mfa/remove"), ({ request }) => {
    const s = authedOr(request);
    if (s instanceof Response) return s;
    if (!freshMfa(request)) return refuse(403, "step_up_required");
    if (!hasFactor(s.userId, "totp")) return refuse(502, "identity_unreachable");
    if (isLastEnforcedFactor(s.userId, "totp")) return refuse(409, "last_factor");
    removeFactor(s.userId, "totp");
    endSession(s);
    return HttpResponse.json(
      { ok: true, signedOut: true },
      { headers: { "Set-Cookie": `${MOCK_SESSION_COOKIE}=; Path=/; Max-Age=-1` } },
    );
  }),
];
