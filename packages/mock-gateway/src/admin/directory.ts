import type { MockGroup } from "#mock/fixtures/world";

import { USERS } from "#mock/fixtures/users";
import { mockState, onMockReset } from "#mock/state";

const original = structuredClone(USERS);

// Users live in USERS, which the admin screens change (names, roles, new accounts).
onMockReset(() => {
  USERS.splice(0, USERS.length, ...structuredClone(original));
});

/** The groups, from the shared mock world. */
export const groups = (): MockGroup[] => mockState.world.groups;

export const groupsOf = (userId: string): MockGroup[] =>
  mockState.world.groups.filter((g) =>
    mockState.world.groupMembers.some((m) => m.groupId === g.id && m.userId === userId),
  );

export const membersOf = (groupId: string) =>
  USERS.filter((u) =>
    mockState.world.groupMembers.some((m) => m.groupId === groupId && m.userId === u.id),
  );
