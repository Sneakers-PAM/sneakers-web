import type { MockFolder, MockLease, MockSecret } from "#mock/fixtures/world";

import { userById } from "#mock/fixtures/users";
import { mockState } from "#mock/state";

/*
 * Who may see, read and approve a secret in the mock, shared by every staff area so the
 * screens agree with each other.
 */

const world = () => mockState.world;

export const secretById = (id: string): MockSecret | undefined =>
  world().secrets.find((s) => s.id === id);

/** A folder and its parents, nearest first. */
export const chain = (folderId: string): MockFolder[] => {
  const out: MockFolder[] = [];
  let f = world().folders.find((x) => x.id === folderId);
  while (f && !out.includes(f)) {
    out.push(f);
    f = f.parentId ? world().folders.find((x) => x.id === f?.parentId) : undefined;
  }
  return out;
};

export const activeLease = (secretId: string): MockLease | undefined =>
  world().leases.find((l) => l.secretId === secretId && !l.returned);

/** Someone else's personal folder hides a secret entirely: `secret` answers null for it. */
export const canSee = (userId: string, s: MockSecret): boolean =>
  !chain(s.folderId).some((f) => f.scope === "personal" && f.ownerUserId !== userId);

/** RACI A: owners of the folder chain (and root). Being a site admin alone isn't enough. */
export const canApprove = (userId: string, s: MockSecret): boolean =>
  canSee(userId, s) &&
  (!!userById(userId)?.isRoot || chain(s.folderId).some((f) => f.owners.includes(userId)));

/** The world's one answer for everyone, plus the read an approved request's lease grants. */
export const canRead = (userId: string, s: MockSecret): boolean =>
  canSee(userId, s) && (s.canRead || activeLease(s.id)?.userId === userId);
