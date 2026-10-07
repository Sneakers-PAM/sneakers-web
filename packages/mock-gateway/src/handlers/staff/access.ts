import type { MockFolder, MockLease, MockSecret } from "#mock/fixtures/world";

import { hidden, resolve, secretChain } from "#mock/handlers/raci";
import { mockState } from "#mock/state";

/*
 * Who may see, read and approve a secret in the mock, shared by every staff area so the
 * screens agree with each other. Read and approve come from the shared RACI resolver, the way
 * the vault decides them.
 */

const world = () => mockState.world;

export const secretById = (id: string): MockSecret | undefined =>
  world().secrets.find((s) => s.id === id);

/** The next manual position in a folder, for a secret that's new, moved in, or restored:
 * last, the way the vault places one. */
export const lastPositionIn = (folderId: string): number =>
  1 +
  Math.max(
    0,
    ...world()
      .secrets.filter((s) => s.folderId === folderId && !s.retired)
      .map((s) => s.position),
  );

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
export const canSee = (userId: string, s: MockSecret): boolean => {
  const f = world().folders.find((x) => x.id === s.folderId);
  return !!f && !hidden(userId, f);
};

/** RACI A over the secret's chain. */
export const canApprove = (userId: string, s: MockSecret): boolean =>
  canSee(userId, s) && resolve(userId, secretChain(s)).approve.allowed;

/** RACI C over the secret's chain, plus the read an approved request's lease grants. */
export const canRead = (userId: string, s: MockSecret): boolean =>
  canSee(userId, s) &&
  (resolve(userId, secretChain(s)).read.allowed || activeLease(s.id)?.userId === userId);
