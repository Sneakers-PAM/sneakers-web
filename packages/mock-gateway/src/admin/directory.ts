import { USERS } from "#mock/fixtures/users";
import { onMockReset } from "#mock/state";

export interface MockGroup {
  id: string;
  name: string;
}

export interface MockUserToken {
  clientName: string;
  createdAtUnix: number;
  expiresAtUnix: number;
  id: string;
  label: string;
  lastUsedAtUnix: number;
  revokedAtUnix: number;
  userId: string;
}

const DAY = 86_400;
const now = () => Math.floor(Date.now() / 1000);

const groups = (): MockGroup[] => [
  { id: "mock-group-platform", name: "Platform engineers" },
  { id: "mock-group-db", name: "DB team" },
  { id: "mock-group-finance", name: "Finance" },
];

const members = (): [string, string][] => [
  ["mock-group-platform", "mock-user-alice"],
  ["mock-group-platform", "mock-user-carol"],
  ["mock-group-db", "mock-user-bob"],
  ["mock-group-db", "mock-user-dave"],
  ["mock-group-finance", "mock-user-erin"],
];

const tokens = (): MockUserToken[] => {
  const t = now();
  return [
    {
      clientName: "MCP client",
      createdAtUnix: t - 20 * DAY,
      expiresAtUnix: t + 70 * DAY,
      id: "mock-token-alice-laptop",
      label: "alice-laptop",
      lastUsedAtUnix: t - 3600,
      revokedAtUnix: 0,
      userId: "mock-user-alice",
    },
    {
      clientName: "Sneakers CLI",
      createdAtUnix: t - 40 * DAY,
      expiresAtUnix: t + 50 * DAY,
      id: "mock-token-carol-cli",
      label: "admin-cli",
      lastUsedAtUnix: t - 2 * DAY,
      revokedAtUnix: 0,
      userId: "mock-user-carol",
    },
    {
      clientName: "MCP client",
      createdAtUnix: t - 90 * DAY,
      expiresAtUnix: t + 10 * DAY,
      id: "mock-token-dave-desktop",
      label: "old-desktop",
      lastUsedAtUnix: t - 30 * DAY,
      revokedAtUnix: t - 25 * DAY,
      userId: "mock-user-dave",
    },
  ];
};

const original = structuredClone(USERS);

/** The mock directory: groups, memberships and personal tokens. Users live in USERS. */
export const directory = {
  groups: groups(),
  members: members(),
  tokens: tokens(),
};

onMockReset(() => {
  USERS.splice(0, USERS.length, ...structuredClone(original));
  directory.groups = groups();
  directory.members = members();
  directory.tokens = tokens();
});

export const groupsOf = (userId: string): MockGroup[] =>
  directory.groups.filter((g) =>
    directory.members.some(([gid, uid]) => gid === g.id && uid === userId),
  );

export const membersOf = (groupId: string) =>
  USERS.filter((u) => directory.members.some(([gid, uid]) => gid === groupId && uid === u.id));
