import { initialInbox, type MockNotification } from "#mock/fixtures/inbox";

/** The mock gateway's session store key. "mock:" keeps it apart from anything live. */
export const MOCK_SESSION_KEY = "mock:sneakers.gateway-session";

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

const randomId = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;

export const newToken = (prefix: string) => randomId(prefix);

/**
 * The mock gateway's whole state. The session survives a reload of the tab (sessionStorage,
 * under a mock-only key); everything else resets on reload.
 */
/** The challenge the mock single sign-on hands back (see vite.ts): Alice, code or email. */
export const SSO_PENDING_ID = "mock-pending-sso";
const ssoPending = (): [string, MockPending][] => [
  [SSO_PENDING_ID, { factors: ["totp", "email"], userId: "mock-user-alice" }],
];

export const db = {
  enrollments: new Map<string, string>(),
  inbox: initialInbox() as MockNotification[],
  needsSetup: false,
  pending: new Map<string, MockPending>(ssoPending()),
};

export const readSession = (): MockSession | null => {
  const raw = sessionStorage.getItem(MOCK_SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MockSession;
  } catch {
    return null;
  }
};

/** Reset everything (tests call this between cases). */
export const resetMockState = (): void => {
  db.pending = new Map(ssoPending());
  db.inbox = initialInbox();
  db.enrollments.clear();
  db.needsSetup = false;
  writeSession(null);
};

export const writeSession = (s: MockSession | null): void => {
  if (s) sessionStorage.setItem(MOCK_SESSION_KEY, JSON.stringify(s));
  else sessionStorage.removeItem(MOCK_SESSION_KEY);
};
