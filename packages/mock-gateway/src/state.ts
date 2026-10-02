import { initialInbox, type MockNotification } from "#mock/fixtures/inbox";
import { initialWorld } from "#mock/fixtures/world";

/** Where the mock gateway "answers". The .invalid name never resolves, so nothing can leak past it. */
export const MOCK_GATEWAY_URL = "https://mock-gateway.example.invalid";

/** The mock gateway's session cookie. Live uses sneakers_sid; the names never overlap. */
export const MOCK_SESSION_COOKIE = "mock_sneakers_sid";

export interface MockPending {
  factors: string[];
  userId: string;
}

export interface MockSession {
  csrf: string;
  enrolled: boolean;
  enrollmentRequired: boolean;
  mfaVerified: boolean;
  setupRecommended: boolean;
  userId: string;
}

export const newToken = (prefix: string): string =>
  `${prefix}-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;

/** The challenge the mock single sign-on hands back: Alice, by code or email. */
export const SSO_PENDING_ID = "mock-pending-sso";

const ssoPending = (): [string, MockPending][] => [
  [SSO_PENDING_ID, { factors: ["totp", "email"], userId: "mock-user-alice" }],
];

/**
 * The mock gateway's whole state, in the app server's memory. It resets when the server
 * restarts, and tests reset it between cases.
 */
export const mockState = {
  enrollments: new Map<string, string>(),
  inbox: initialInbox() as MockNotification[],
  needsSetup: false,
  pending: new Map<string, MockPending>(ssoPending()),
  sessions: new Map<string, MockSession>(),
  /** The invented organisation the staff screens read and change. */
  world: initialWorld(),
};

/** Reset everything (tests call this between cases). */
export const resetMockState = (): void => {
  mockState.enrollments.clear();
  mockState.inbox = initialInbox();
  mockState.needsSetup = false;
  mockState.pending = new Map(ssoPending());
  mockState.sessions.clear();
  mockState.world = initialWorld();
};
