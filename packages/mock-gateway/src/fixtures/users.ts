import type { SecondFactor } from "@sneakers-web/api-client";

export interface MockUser {
  disabled: boolean;
  email: string;
  emailVerified: boolean;
  /** Second factors the user has, which decides the login path. */
  factors: SecondFactor[];
  id: string;
  isRoot: boolean;
  /** MFA is enforced for this user and they have no factor yet. */
  mustEnroll?: boolean;
  name: string;
  roles: string[];
  username: string;
}

/** Invented people on example.org. Every id starts with "mock-". */
export const USERS: MockUser[] = [
  {
    disabled: false,
    email: "alice@example.org",
    emailVerified: true,
    factors: ["totp", "email"],
    id: "mock-user-alice",
    isRoot: false,
    name: "Alice",
    roles: ["site-admin"],
    username: "alice",
  },
  {
    disabled: false,
    email: "bob@example.org",
    emailVerified: true,
    factors: [],
    id: "mock-user-bob",
    isRoot: false,
    name: "Bob",
    roles: [],
    username: "bob",
  },
  {
    disabled: false,
    email: "carol@example.org",
    emailVerified: true,
    factors: ["totp"],
    id: "mock-user-carol",
    isRoot: true,
    name: "Carol",
    roles: ["site-admin"],
    username: "carol",
  },
  {
    disabled: false,
    email: "dave@example.org",
    emailVerified: false,
    factors: [],
    id: "mock-user-dave",
    isRoot: false,
    mustEnroll: true,
    name: "Dave",
    roles: [],
    username: "dave",
  },
  {
    disabled: true,
    email: "erin@example.org",
    emailVerified: true,
    factors: [],
    id: "mock-user-erin",
    isRoot: false,
    name: "Erin",
    roles: [],
    username: "erin",
  },
  {
    disabled: false,
    email: "grace@example.org",
    emailVerified: true,
    factors: ["totp"],
    id: "mock-user-grace",
    isRoot: false,
    name: "Grace",
    roles: ["recovery"],
    username: "grace",
  },
];

export const findUser = (identifier: string): MockUser | undefined => {
  const id = identifier.trim().toLowerCase();
  return USERS.find((u) => u.username === id || u.email === id);
};

export const userById = (id: string): MockUser | undefined => {
  return USERS.find((u) => u.id === id);
};

/** The one-time code the mock always refuses, so the "wrong code" state can be tried. */
export const WRONG_CODE = "000000";
