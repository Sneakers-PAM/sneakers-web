import type { GraphQLErrorItem } from "@sneakers-web/api-client";

import { http, HttpResponse } from "msw";

import { WRONG_CODE } from "#mock/fixtures/users";
import { authed } from "#mock/handlers/auth";
import { MOCK_GATEWAY_URL, MOCK_SESSION_COOKIE, type MockSession, mockState } from "#mock/state";

/** How long a step-up stays fresh in the mock, standing in for the vault's MFA_MAX_AGE. */
export const MOCK_MFA_MAX_AGE_MS = 5 * 60_000;

/** Wrong proofs before the gateway ends the session. */
const MAX_FAILURES = 5;

const at = (path: string) => `${MOCK_GATEWAY_URL}${path}`;
const refuse = (status: number, error: string, headers?: HeadersInit) =>
  HttpResponse.json({ error } as never, { headers, status });

/** Whether the request's session passed a step-up recently enough for a guarded reveal. */
export const freshMfa = (request: Request): boolean => {
  const verifiedAt = authed(request)?.mfaVerifiedAt;
  return verifiedAt !== undefined && Date.now() - verifiedAt < MOCK_MFA_MAX_AGE_MS;
};

/** The refusal the vault sends when a reveal needs a fresher second factor. */
export const stepUpRequired = (): GraphQLErrorItem => ({
  extensions: { code: "FAILED_PRECONDITION", reason: "STEP_UP_REQUIRED" },
  message: "rpc error: code = FailedPrecondition desc = a fresh second factor is required",
});

const endSession = (s: MockSession) => {
  for (const [sid, session] of mockState.sessions) {
    if (session === s) mockState.sessions.delete(sid);
  }
};

export const stepUpHandlers = [
  http.post(at("/auth/mfa/step-up"), async ({ request }) => {
    const s = authed(request);
    if (!s) return refuse(401, "no_session");
    const body = (await request.json().catch(() => ({}))) as { code?: string; kind?: string };
    if ((body.kind !== "totp" && body.kind !== "email") || !body.code)
      return refuse(400, "invalid_request");
    if (body.code === WRONG_CODE) {
      s.stepUpFailures = (s.stepUpFailures ?? 0) + 1;
      if (s.stepUpFailures >= MAX_FAILURES) {
        endSession(s);
        return refuse(401, "session_revoked", {
          "Set-Cookie": `${MOCK_SESSION_COOKIE}=; Path=/; Max-Age=0`,
        });
      }
      return refuse(401, "invalid_code");
    }
    s.stepUpFailures = 0;
    s.mfaVerifiedAt = Date.now();
    return HttpResponse.json({ mfaVerifiedAt: Math.floor(s.mfaVerifiedAt / 1000) });
  }),

  http.post(at("/auth/mfa/step-up/email/send"), ({ request }) =>
    authed(request) ? HttpResponse.json({ status: "sent" }) : refuse(401, "no_session"),
  ),

  // The mock has no passkeys, as at sign-in.
  http.post(at("/auth/mfa/step-up/passkey/begin"), ({ request }) =>
    authed(request) ? refuse(400, "no_passkey") : refuse(401, "no_session"),
  ),
];
