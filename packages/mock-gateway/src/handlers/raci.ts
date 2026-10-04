import type { MockFolder, MockRaciRule, MockSecret } from "#mock/fixtures/world";

import { groupsOf } from "#mock/admin/directory";
import { isSiteAdmin, refusal } from "#mock/admin/refuse";
import { userById } from "#mock/fixtures/users";
import { mockState, newToken } from "#mock/state";

/*
 * The mock's one copy of the vault's firewall-RACI rules, shared by the staff and admin answers.
 * It mirrors sneakers-vault internal/vault/authz/resolve.go and ruleset.go (Resolve,
 * decideAction, subjectMatches) and the gates in internal/vault/grpcsvc/raci.go, simulate.go and
 * server.go (isFolderOwner, isHumanAdmin):
 *
 * - site admins and root read everything;
 * - owners of the folder or any folder above it get read, approve and manage (never informed);
 * - otherwise, per action, the first rule with an answer wins: the folder's (or secret's) own
 *   rules top to bottom, then each folder above, nearest first; nothing matched is a deny;
 * - manage or approve implies read, read gates approve and manage, informed stands alone.
 */

/** FolderAccess, for myFolderAccess and mySecretAccess. */
export interface AccessView {
  approve: boolean;
  informed: boolean;
  manage: boolean;
  manageRuleset: boolean;
  read: boolean;
  reveal: boolean;
}

export interface Decision {
  allowed: boolean;
  reason: string;
}

/** RaciDecision, for simulateFolder and simulateSecret. */
export interface DecisionView {
  approve: boolean;
  approveReason: string;
  informed: boolean;
  informedReason: string;
  manage: boolean;
  manageReason: string;
  read: boolean;
  readReason: string;
  reveal: boolean;
  revealReason: string;
}

export interface FolderRulesetView {
  folderId: string;
  inherited: InheritedRuleView[];
  inheritedOwners: { fromFolderId: string; fromFolderName: string; userId: string }[];
  owners: string[];
  rules: RaciRuleView[];
}

export interface InheritedRuleView {
  fromFolderId: string;
  fromFolderName: string;
  rule: RaciRuleView;
}

/** A gated call's answer: its value, or the refusal to send back as the GraphQL answer. */
export type Outcome<T> = { ok: false; refusal: never } | { ok: true; value: T };

export type RaciAction = "A" | "C" | "I" | "R";

/** A RaciRule as the gateway answers it. */
export interface RaciRuleView {
  folderId: string;
  grants: { action: RaciAction; value: "allow" | "deny" }[];
  id: string;
  order: number;
  subjectId: null | string;
  subjectKind: MockRaciRule["subjectKind"];
  subjectName: string;
}

/** The vault's ActionResult: C read, I ack, A approve, R author. */
export interface Resolution {
  ack: Decision;
  approve: Decision;
  author: Decision;
  read: Decision;
}

/** One rule row as the resolver sees it (a stored MockRaciRule without its id). */
export type Rule = Pick<MockRaciRule, "grants" | "subjectId" | "subjectKind" | "subjectName">;

/** A gateway RaciRuleInput, as a handler receives it. */
export interface RuleInput {
  grants: { action: string; value: string }[];
  subjectId?: null | string;
  subjectKind: string;
  subjectName: string;
}

/** One folder (or secret) in a chain: its name for reasons, its owners and its ordered rules. */
export interface Ruleset {
  name: string;
  owners: string[];
  rules: Rule[];
}

export interface SecretRulesetView {
  inherited: InheritedRuleView[];
  rules: RaciRuleView[];
  secretId: string;
}

const ACTIONS: RaciAction[] = ["C", "I", "A", "R"];

const world = () => mockState.world;
const folderById = (id: string) => world().folders.find((f) => f.id === id);
const secretById = (id: string) => world().secrets.find((s) => s.id === id);

const refused = <T>(r: never): Outcome<T> => ({ ok: false, refusal: r });
const done = <T>(value: T): Outcome<T> => ({ ok: true, value });
const notFound = (what: string) => refusal("NOT_FOUND", `${what} not found`);
const denied = (desc: string) => refusal("PERMISSION_DENIED", desc);
const notOwner = () =>
  refusal("PERMISSION_DENIED", "only the folder's owner can do this", "NOT_FOLDER_OWNER");

/** A folder and every folder above it, nearest first. */
const ancestors = (folderId: string): MockFolder[] => {
  const out: MockFolder[] = [];
  for (let f = folderById(folderId); f && !out.includes(f);) {
    out.push(f);
    const parentId: string | undefined = f.parentId;
    f = parentId ? folderById(parentId) : undefined;
  }
  return out;
};

/** Someone else's personal folder (or anything inside it) doesn't exist as far as `userId` knows. */
export const hidden = (userId: string, folder: MockFolder): boolean =>
  ancestors(folder.id).some((c) => c.scope === "personal" && c.ownerUserId !== userId);

const secretHidden = (userId: string, s: MockSecret) => {
  const f = folderById(s.folderId);
  return !f || hidden(userId, f);
};

const ownersOf = (f: MockFolder) =>
  f.scope === "personal" && f.ownerUserId ? [...f.owners, f.ownerUserId] : [...f.owners];

const ownRules = (folderId: string) => world().folderRules.filter((r) => r.folderId === folderId);
const secretRules = (secretId: string) =>
  world().secretRules.filter((r) => r.secretId === secretId);

/** A folder's chain for `resolve`, nearest first. `draft` stands in for the folder's own rules. */
export const folderChain = (folderId: string, draft?: Rule[]): Ruleset[] =>
  ancestors(folderId).map((f, index) => ({
    name: f.name,
    owners: ownersOf(f),
    rules: index === 0 && draft ? draft : ownRules(f.id),
  }));

/** A secret's chain: its own rules (or `draft`) first, with no owners, then its folder's chain. */
export const secretChain = (secret: MockSecret, draft?: Rule[]): Ruleset[] => [
  { name: secret.name, owners: [], rules: draft ?? secretRules(secret.id) },
  ...folderChain(secret.folderId),
];

interface Subject {
  groupIds: string[];
  groupNames: string[];
  isAdmin: boolean;
  userId: string;
}

const subjectOf = (userId: string): Subject => {
  const groups = groupsOf(userId);
  return {
    groupIds: groups.map((g) => g.id),
    groupNames: groups.map((g) => g.name),
    isAdmin: isSiteAdmin(userId),
    userId,
  };
};

const matches = (u: Subject, r: Rule) => {
  if (r.subjectKind === "everyone") return true;
  if (r.subjectKind === "user") return r.subjectName === u.userId;
  if (r.subjectId) return u.groupIds.includes(r.subjectId);
  return u.groupNames.some((g) => g.toLowerCase() === r.subjectName.toLowerCase());
};

const ruleReason = (ci: number, ri: number, name: string, effect: string, r: Rule) => {
  const loc = ci > 0 ? `↳ ${name} #${ri + 1}` : `rule #${ri + 1}`;
  const who = r.subjectName ? `${r.subjectKind} ${r.subjectName}` : r.subjectKind;
  return `${loc} ${effect} ${who}`;
};

const decide = (u: Subject, rulesets: Ruleset[], act: RaciAction): Decision => {
  if (act === "C" && u.isAdmin) return { allowed: true, reason: "site-admin reads all" };
  if (act !== "I" && rulesets.some((c) => c.owners.includes(u.userId))) {
    return { allowed: true, reason: "owner (auto read/approve/author)" };
  }
  for (const [ci, c] of rulesets.entries()) {
    for (const [ri, r] of c.rules.entries()) {
      if (!matches(u, r)) continue;
      const g = r.grants[act];
      if (g) return { allowed: g === "allow", reason: ruleReason(ci, ri, c.name, g, r) };
    }
  }
  return { allowed: false, reason: "no rule → default deny" };
};

/** The vault's Resolve: all four actions for `userId` against a chain, nearest first. */
export const resolve = (userId: string, rulesets: Ruleset[]): Resolution => {
  const u = subjectOf(userId);
  let read = decide(u, rulesets, "C");
  if (!read.allowed) {
    if (decide(u, rulesets, "R").allowed) read = { allowed: true, reason: "author implies read" };
    else if (decide(u, rulesets, "A").allowed) {
      read = { allowed: true, reason: "approver implies read" };
    }
  }
  const gate = (act: RaciAction): Decision =>
    read.allowed ? decide(u, rulesets, act) : { allowed: false, reason: "requires read" };
  return { ack: decide(u, rulesets, "I"), approve: gate("A"), author: gate("R"), read };
};

/** The vault's isFolderOwner: a site admin or root, or an owner of the folder or one above it. */
export const ownsFolder = (userId: string, folderId: string): boolean =>
  isSiteAdmin(userId) || ancestors(folderId).some((f) => ownersOf(f).includes(userId));

export const accessView = (r: Resolution, manageRuleset: boolean): AccessView => ({
  approve: r.approve.allowed,
  informed: r.ack.allowed,
  manage: r.author.allowed,
  manageRuleset,
  read: r.read.allowed,
  reveal: r.read.allowed,
});

export const decisionView = (r: Resolution): DecisionView => ({
  approve: r.approve.allowed,
  approveReason: r.approve.reason,
  informed: r.ack.allowed,
  informedReason: r.ack.reason,
  manage: r.author.allowed,
  manageReason: r.author.reason,
  read: r.read.allowed,
  readReason: r.read.reason,
  reveal: r.read.allowed,
  revealReason: r.read.reason,
});

/** A submitted RaciRuleInput as a rule; cells it doesn't know are dropped. */
export const ruleFromInput = (r: RuleInput): Rule => {
  const grants: Rule["grants"] = {};
  for (const g of r.grants) {
    if (ACTIONS.includes(g.action as RaciAction) && (g.value === "allow" || g.value === "deny")) {
      grants[g.action as RaciAction] = g.value;
    }
  }
  const kind = r.subjectKind as Rule["subjectKind"];
  return {
    grants,
    subjectId: kind === "group" ? (r.subjectId ?? undefined) : undefined,
    subjectKind: kind,
    subjectName: kind === "everyone" ? "" : r.subjectName,
  };
};

const ruleView = (r: MockRaciRule, order: number, folderId: string): RaciRuleView => ({
  folderId,
  grants: ACTIONS.flatMap((action) => {
    const value = r.grants[action];
    return value ? [{ action, value }] : [];
  }),
  id: r.id,
  order,
  subjectId: r.subjectKind === "group" ? (r.subjectId ?? null) : null,
  subjectKind: r.subjectKind,
  subjectName: r.subjectName,
});

const inheritedFrom = (folders: MockFolder[]): InheritedRuleView[] =>
  folders.flatMap((f) =>
    ownRules(f.id).map((r, index) => ({
      fromFolderId: f.id,
      fromFolderName: f.name,
      rule: ruleView(r, index, f.id),
    })),
  );

const seenFolder = (userId: string, folderId: string) => {
  const f = folderById(folderId);
  return f && !hidden(userId, f) ? f : undefined;
};

const seenSecret = (userId: string, secretId: string) => {
  const s = secretById(secretId);
  return s && !secretHidden(userId, s) ? s : undefined;
};

/** myFolderAccess. */
export const folderAccess = (userId: string, folderId: string): Outcome<AccessView> => {
  const f = seenFolder(userId, folderId);
  if (!f) return refused(notFound("folder"));
  return done(accessView(resolve(userId, folderChain(f.id)), ownsFolder(userId, f.id)));
};

/** mySecretAccess: managing a secret's ruleset is for its folder's owners. */
export const secretAccess = (userId: string, secretId: string): Outcome<AccessView> => {
  const s = seenSecret(userId, secretId);
  if (!s) return refused(notFound("secret"));
  return done(accessView(resolve(userId, secretChain(s)), ownsFolder(userId, s.folderId)));
};

/**
 * folderRuleset, read-gated as the vault's GetFolderRuleset: anyone who can read the folder, or
 * owns it. Own rules in order; rules and owners from the folders above, each with its source.
 */
export const folderRuleset = (userId: string, folderId: string): Outcome<FolderRulesetView> => {
  const f = seenFolder(userId, folderId);
  if (!f) return refused(notFound("folder"));
  if (!resolve(userId, folderChain(f.id)).read.allowed && !ownsFolder(userId, f.id)) {
    return refused(denied("not permitted to view this folder's ruleset"));
  }
  const above = ancestors(f.id).slice(1);
  const own = new Set(f.owners);
  const inheritedOwners: FolderRulesetView["inheritedOwners"] = [];
  for (const a of above) {
    for (const o of ownersOf(a)) {
      if (own.has(o) || inheritedOwners.some((x) => x.userId === o)) continue;
      inheritedOwners.push({ fromFolderId: a.id, fromFolderName: a.name, userId: o });
    }
  }
  return done({
    folderId: f.id,
    inherited: inheritedFrom(above),
    inheritedOwners,
    owners: [...f.owners],
    rules: ownRules(f.id).map((r, index) => ruleView(r, index, f.id)),
  });
};

/** secretRuleset, read-gated as the vault's GetSecretRuleset: read or informed on the secret. */
export const secretRuleset = (userId: string, secretId: string): Outcome<SecretRulesetView> => {
  const s = seenSecret(userId, secretId);
  if (!s) return refused(notFound("secret"));
  const r = resolve(userId, secretChain(s));
  if (!r.read.allowed && !r.ack.allowed) {
    return refused(denied("not permitted to view this secret's ruleset"));
  }
  return done({
    inherited: inheritedFrom(ancestors(s.folderId)),
    rules: secretRules(s.id).map((x, index) => ruleView(x, index, s.folderId)),
    secretId: s.id,
  });
};

/** The vault refuses a non-admin who adds, removes or changes an everyone rule. */
const everyoneUnchanged = (before: Rule[], after: Rule[]) => {
  const pick = (rules: Rule[]) =>
    rules.filter((r) => r.subjectKind === "everyone").map((r) => JSON.stringify(r.grants));
  return JSON.stringify(pick(before)) === JSON.stringify(pick(after));
};

/** The checks on a submitted ruleset; a refusal, or null when it's fine. */
const badRules = (actorId: string, before: Rule[], rules: Rule[]) => {
  if (rules.some((r) => r.subjectKind === "group" && !r.subjectId)) {
    return refusal("INVALID_ARGUMENT", "a group rule needs the group's id", "GROUP_ID_REQUIRED");
  }
  if (!isSiteAdmin(actorId) && !everyoneUnchanged(before, rules)) {
    return denied("only admins can set everyone rules");
  }
  return null;
};

/** setFolderRuleset: replaces the folder's owners and ordered rules. Owners or site admins only. */
export const setFolderRuleset = (
  actorId: string,
  folderId: string,
  owners: string[],
  rules: RuleInput[],
): Outcome<FolderRulesetView> => {
  const f = seenFolder(actorId, folderId);
  if (!f) return refused(notFound("folder"));
  if (!ownsFolder(actorId, f.id)) return refused(notOwner());
  const next = rules.map((r) => ruleFromInput(r));
  const bad = badRules(actorId, ownRules(f.id), next);
  if (bad) return refused(bad);
  world().folderRules = [
    ...world().folderRules.filter((r) => r.folderId !== f.id),
    ...next.map((r) => ({ ...r, folderId: f.id, id: newToken("mock-rule") })),
  ];
  f.owners = [...owners];
  return folderRuleset(actorId, f.id);
};

/** setSecretRuleset: replaces the secret's ordered rules. Its folder's owners or site admins only. */
export const setSecretRuleset = (
  actorId: string,
  secretId: string,
  rules: RuleInput[],
): Outcome<SecretRulesetView> => {
  const s = seenSecret(actorId, secretId);
  if (!s) return refused(notFound("secret"));
  if (!ownsFolder(actorId, s.folderId)) return refused(notOwner());
  const next = rules.map((r) => ruleFromInput(r));
  const bad = badRules(actorId, secretRules(s.id), next);
  if (bad) return refused(bad);
  world().secretRules = [
    ...world().secretRules.filter((r) => r.secretId !== s.id),
    ...next.map((r) => ({ ...r, id: newToken("mock-rule"), secretId: s.id })),
  ];
  return done({
    inherited: inheritedFrom(ancestors(s.folderId)),
    rules: secretRules(s.id).map((x, index) => ruleView(x, index, s.folderId)),
    secretId: s.id,
  });
};

/** simulateFolder: `userId` against unsaved `draftRules` for the folder. Owners only, as the vault. */
export const simulateFolder = (
  actorId: string,
  folderId: string,
  userId: string,
  draftRules: RuleInput[],
): Outcome<DecisionView> => {
  const f = seenFolder(actorId, folderId);
  if (!f) return refused(notFound("folder"));
  if (!ownsFolder(actorId, f.id)) {
    return refused(denied("not permitted to simulate this folder's ruleset"));
  }
  if (!userById(userId)) return refused(notFound("user"));
  const draft = draftRules.map((r) => ruleFromInput(r));
  return done(decisionView(resolve(userId, folderChain(f.id, draft))));
};

/** simulateSecret: `userId` against unsaved `draftRules` for the secret, over its real folders. */
export const simulateSecret = (
  actorId: string,
  secretId: string,
  userId: string,
  draftRules: RuleInput[],
): Outcome<DecisionView> => {
  const s = seenSecret(actorId, secretId);
  if (!s) return refused(notFound("secret"));
  if (!ownsFolder(actorId, s.folderId)) {
    return refused(denied("not permitted to simulate this secret's ruleset"));
  }
  if (!userById(userId)) return refused(notFound("user"));
  const draft = draftRules.map((r) => ruleFromInput(r));
  return done(decisionView(resolve(userId, secretChain(s, draft))));
};
