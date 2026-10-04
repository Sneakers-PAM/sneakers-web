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

/**
 * Ids with this prefix start a fresh request the first time the consent page asks for one,
 * standing in for the agent's /oauth2/authorize, which a browser can't reach in mock mode.
 * Each id starts only once, so an answered one stays answered.
 */
export const MOCK_CONSENT_NEW_PREFIX = "mock-consent-new-";

const MINUTE = 60_000;
const REQUEST_TTL_MS = 10 * MINUTE;

const request = (id: string, expiresAt: number, state: string): MockConsentRequest => ({
  clientName: "MCP client",
  expiresAt,
  id,
  redirectUri: "http://127.0.0.1:53682/callback",
  state,
});

const initialConsents = (now = Date.now()): Map<string, MockConsentRequest> =>
  new Map(
    [
      request(MOCK_CONSENT_ID, now + REQUEST_TTL_MS, "mock-state-1"),
      request(MOCK_CONSENT_EXPIRED_ID, now - MINUTE, "mock-state-2"),
    ].map((r) => [r.id, r]),
  );

/** The agents area's own mock state: consent requests waiting for an answer. */
export const agentsState = { consents: initialConsents(), started: new Set<string>() };

/** The consent request behind `id`, starting it first when it's a new mock id. */
export const consentRequest = (id: string): MockConsentRequest | undefined => {
  if (id.startsWith(MOCK_CONSENT_NEW_PREFIX) && !agentsState.started.has(id)) {
    agentsState.started.add(id);
    agentsState.consents.set(id, request(id, Date.now() + REQUEST_TTL_MS, `mock-state-${id}`));
  }
  return agentsState.consents.get(id);
};

onMockReset(() => {
  agentsState.consents = initialConsents();
  agentsState.started = new Set();
});
