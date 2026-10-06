import type { MockSecret, MockSecretUse } from "#mock/fixtures/world";

import { USERS } from "#mock/fixtures/users";
import { secretChain } from "#mock/handlers/raci";
import { canApprove } from "#mock/handlers/staff/access";
import { mockState } from "#mock/state";

/*
 * The vault's approval levels, for the mock: normal, approval-required (owners exempt, a
 * non-owner needs one owner) and always-approve (everyone needs another owner or a RACI A
 * approver). The requester never decides their own use; when nobody else can, they confirm it
 * once. The mock knows every person, so "nobody else" is exact here.
 */

const world = () => mockState.world;

// The vault keeps one confirmation good for the rest of its run for an hour.
const RUN_CONFIRM_SPAN_S = 3600;

export const approvalLevel = (s: MockSecret): 0 | 1 | 2 => {
  if (s.alwaysRequireApproval) return 2;
  return s.requireTokenApproval ? 1 : 0;
};

/** The owners of the secret's folder and every folder above it. */
export const secretOwners = (s: MockSecret): string[] => [
  ...new Set(secretChain(s).flatMap((c) => c.owners)),
];

/** Whether a use by `userId` waits for a decision. */
export const needsApproval = (userId: string, s: MockSecret): boolean => {
  const level = approvalLevel(s);
  if (level === 2) return true;
  return level === 1 && !secretOwners(s).includes(userId);
};

/** An owner, or for always-approve also a RACI A approver; whoever asked. */
const eligible = (userId: string, s: MockSecret): boolean =>
  secretOwners(s).includes(userId) || (approvalLevel(s) === 2 && canApprove(userId, s));

/** Whether `userId` may decide a use `requester` asked for: never their own. */
export const mayDecide = (userId: string, s: MockSecret, requester: string): boolean =>
  userId !== requester && eligible(userId, s);

/** Nobody else can decide, so the requester confirms; null when nobody at all can. */
export const confirmMode = (userId: string, s: MockSecret): boolean | null => {
  const others = USERS.filter((u) => !u.disabled && u.id !== userId);
  if (others.some((u) => mayDecide(u.id, s, userId))) return false;
  if (others.length === 0 || eligible(userId, s)) return true;
  return null;
};

/** Whether the requester confirmed another use of this run, from the same token, lately. */
export const runConfirmed = (u: MockSecretUse, nowUnix: number): boolean =>
  !!u.runId &&
  world().secretUses.some(
    (x) =>
      x.ownerUserId === u.ownerUserId &&
      x.tokenId === u.tokenId &&
      x.runId === u.runId &&
      !!x.confirmedAtUnix &&
      x.confirmedAtUnix >= nowUnix - RUN_CONFIRM_SPAN_S,
  );
