import type { SecondFactor } from "@sneakers-web/api-client";

import { userById, USERS } from "#mock/fixtures/users";
import { onMockReset } from "#mock/state";

/*
 * The second factors behind the staff Security page. Which kinds a user has stays on the
 * fixture user (`factors`, which the sign-in mock reads), so a change here also changes how
 * that person signs in. This module adds what the factor list shows and puts every user's
 * factors back on a mock reset.
 */

/**
 * One factor as GET /auth/mfa/factors lists it (gateway 82ac608). Times are RFC 3339 or null:
 * identity doesn't record TOTP use, and the email factor is implicit, so it has no times.
 */
export interface MockFactor {
  createdAt: null | string;
  id: string;
  kind: SecondFactor;
  label: string;
  lastUsedAt: null | string;
}

const DAY = 86_400_000;

const original = new Map(USERS.map((u) => [u.id, [...u.factors]]));

/** When a factor was added, for the ones added since the reset. */
const added = new Map<string, string>();

const key = (userId: string, kind: SecondFactor) => `${userId}:${kind}`;

const createdAt = (userId: string, kind: SecondFactor): string =>
  added.get(key(userId, kind)) ?? new Date(Date.now() - 31 * DAY).toISOString();

/**
 * The user's factors in the gateway's order: TOTP, each passkey, then email. Email is listed
 * for everyone with an address, whether or not it's on the sign-in challenge.
 */
export const factorsOf = (userId: string): MockFactor[] => {
  const user = userById(userId);
  if (!user) return [];
  const out: MockFactor[] = [];
  if (user.factors.includes("totp")) {
    out.push({
      createdAt: createdAt(userId, "totp"),
      id: "totp",
      kind: "totp",
      label: "Authenticator app",
      lastUsedAt: null,
    });
  }
  if (user.factors.includes("passkey")) {
    out.push({
      createdAt: createdAt(userId, "passkey"),
      id: `mock-credential-${user.username}`,
      kind: "passkey",
      label: "Passkey",
      lastUsedAt: null,
    });
  }
  if (user.email) {
    out.push({ createdAt: null, id: "email", kind: "email", label: "Email", lastUsedAt: null });
  }
  return out;
};

export const hasFactor = (userId: string, kind: SecondFactor): boolean =>
  !!userById(userId)?.factors.includes(kind);

/** A confirmed new factor: listed from now on, and offered at the next sign-in. */
export const addFactor = (userId: string, kind: SecondFactor): void => {
  const user = userById(userId);
  if (!user || user.factors.includes(kind)) return;
  user.factors = [...user.factors, kind];
  added.set(key(userId, kind), new Date().toISOString());
};

export const removeFactor = (userId: string, kind: SecondFactor): void => {
  const user = userById(userId);
  if (!user) return;
  user.factors = user.factors.filter((f) => f !== kind);
  added.delete(key(userId, kind));
};

const strong = (factors: SecondFactor[]) => factors.filter((f) => f !== "email");

/**
 * Whether removing `kind` would leave a user that must use MFA with no TOTP or passkey, which
 * the gateway refuses (409 last_factor). The implicit email factor doesn't count.
 */
export const isLastEnforcedFactor = (userId: string, kind: SecondFactor): boolean => {
  const user = userById(userId);
  if (!user?.mustEnroll) return false;
  const left = strong(user.factors);
  return left.length === 1 && left[0] === kind;
};

/** Adding a factor needs a fresh step-up once the user has TOTP or a passkey. */
export const addNeedsStepUp = (userId: string): boolean =>
  strong(userById(userId)?.factors ?? []).length > 0;

onMockReset(() => {
  for (const user of USERS) user.factors = [...(original.get(user.id) ?? [])];
  added.clear();
});
