import { onMockReset } from "#mock/state";

/** A pending MCP sign-in, as the gateway holds it between /oauth2/authorize and consent. */
export interface MockConsentRequest {
  clientName: string;
  expiresAt: number;
  id: string;
  redirectUri: string;
  state: string;
}

/** The sign-in an agent on 127.0.0.1 started. Open /oauth/consent?req=mock-consent-1 to answer it. */
export const MOCK_CONSENT_ID = "mock-consent-1";
export const MOCK_CONSENT_EXPIRED_ID = "mock-consent-expired";

const MINUTE = 60_000;

const initialConsents = (now = Date.now()): Map<string, MockConsentRequest> =>
  new Map(
    [
      {
        clientName: "MCP client",
        expiresAt: now + 10 * MINUTE,
        id: MOCK_CONSENT_ID,
        redirectUri: "http://127.0.0.1:53682/callback",
        state: "mock-state-1",
      },
      {
        clientName: "MCP client",
        expiresAt: now - MINUTE,
        id: MOCK_CONSENT_EXPIRED_ID,
        redirectUri: "http://127.0.0.1:53682/callback",
        state: "mock-state-2",
      },
    ].map((r) => [r.id, r]),
  );

/** The agents area's own mock state: consent requests waiting for an answer. */
export const agentsState = { consents: initialConsents() };

onMockReset(() => {
  agentsState.consents = initialConsents();
});
