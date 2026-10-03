import {
  SharingFolderAccessDocument,
  SharingFolderRulesetDocument,
  SharingFoldersDocument,
  type SharingRuleFieldsFragment,
  SharingSearchUsersDocument,
  SharingSecretAccessDocument,
  SharingSecretDocument,
  SharingSecretRulesetDocument,
  SharingSetFolderRulesetDocument,
  SharingSetSecretRulesetDocument,
  SharingSimulateFolderDocument,
  SharingSimulateSecretDocument,
  SharingUserLabelsDocument,
} from "@sneakers-web/api-client";
import { HttpResponse } from "msw";

import type { MockFolder, MockRaciRule, MockSecret } from "#mock/fixtures/world";

import { groupsOf } from "#mock/admin/directory";
import { isSiteAdmin, refusal } from "#mock/admin/refuse";
import { userById, USERS } from "#mock/fixtures/users";
import { api, asUser } from "#mock/handlers/graphql";
import { canSee, chain, secretById } from "#mock/handlers/staff/access";
import { mockState, newToken } from "#mock/state";

/*
 * Mock answers for sharing (S8): folder and secret RACI rulesets, the simulator and the people
 * picker. Decisions mirror the vault's resolver, sneakers-vault internal/vault/authz/resolve.go
 * (Resolve, decideAction) and internal/vault/grpcsvc/raci.go and simulate.go (the gates): site
 * admins and root read everything; owners up the chain get read, approve and manage (never
 * informed); otherwise, per action, the first rule with an answer wins, this folder's (or
 * secret's) rules top to bottom first, then each folder above; manage or approve implies read,
 * read gates approve and manage, informed stands alone; nothing matched is a deny.
 */

type Action = "A" | "C" | "I" | "R";
interface Decision {
  allowed: boolean;
  reason: string;
}

type Rule = Pick<MockRaciRule, "grants" | "subjectId" | "subjectKind" | "subjectName">;

interface Ruleset {
  name: string;
  owners: string[];
  rules: Rule[];
}

interface Subject {
  groupIds: string[];
  groupNames: string[];
  isAdmin: boolean;
  userId: string;
}

const ok = <T>(data: T) => HttpResponse.json({ data }) as never;
const notFound = (what: string) => refusal("NOT_FOUND", `${what} not found`);
const denied = (desc: string) => refusal("PERMISSION_DENIED", desc);
const notOwner = () =>
  refusal("PERMISSION_DENIED", "only the folder's owner can do this", "NOT_FOLDER_OWNER");

const world = () => mockState.world;
const folderById = (id: string) => world().folders.find((f) => f.id === id);

const subjectOf = (userId: string): Subject => {
  const groups = groupsOf(userId);
  return {
    groupIds: groups.map((g) => g.id),
    groupNames: groups.map((g) => g.name),
    isAdmin: isSiteAdmin(userId),
    userId,
  };
};

/** Someone else's personal folder (or one inside it) doesn't exist, as far as the user knows. */
const hidden = (userId: string, f: MockFolder) =>
  chain(f.id).some((c) => c.scope === "personal" && c.ownerUserId !== userId);

const ownersOf = (f: MockFolder) =>
  f.scope === "personal" && f.ownerUserId ? [...f.owners, f.ownerUserId] : [...f.owners];

const folderRulesOf = (folderId: string): Rule[] =>
  world().folderRules.filter((r) => r.folderId === folderId);

const rulesetOf = (f: MockFolder, rules = folderRulesOf(f.id)): Ruleset => ({
  name: f.name,
  owners: ownersOf(f),
  rules,
});

const folderChain = (folderId: string): Ruleset[] => chain(folderId).map((f) => rulesetOf(f));

const secretChain = (
  s: MockSecret,
  rules: Rule[] = world().secretRules.filter((r) => r.secretId === s.id),
): Ruleset[] => [{ name: s.name, owners: [], rules }, ...folderChain(s.folderId)];

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

const decide = (u: Subject, rulesets: Ruleset[], act: Action): Decision => {
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

/** The vault's Resolve: all four actions for one user against a chain, nearest first. */
export const resolve = (userId: string, rulesets: Ruleset[]) => {
  const u = subjectOf(userId);
  let read = decide(u, rulesets, "C");
  if (!read.allowed) {
    if (decide(u, rulesets, "R").allowed) read = { allowed: true, reason: "author implies read" };
    else if (decide(u, rulesets, "A").allowed) {
      read = { allowed: true, reason: "approver implies read" };
    }
  }
  const gate = (act: Action): Decision =>
    read.allowed ? decide(u, rulesets, act) : { allowed: false, reason: "requires read" };
  return { ack: decide(u, rulesets, "I"), approve: gate("A"), author: gate("R"), read };
};

/** The vault's isFolderOwner: a site admin or root, or an owner of the folder or one above it. */
export const ownsFolder = (userId: string, folderId: string): boolean =>
  isSiteAdmin(userId) || chain(folderId).some((f) => ownersOf(f).includes(userId));

const accessOf = (r: ReturnType<typeof resolve>, manageRuleset: boolean) => ({
  approve: r.approve.allowed,
  informed: r.ack.allowed,
  manage: r.author.allowed,
  manageRuleset,
  read: r.read.allowed,
  reveal: r.read.allowed,
});

const decisionOf = (r: ReturnType<typeof resolve>) => ({
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

const ACTIONS: Action[] = ["C", "I", "A", "R"];

const toRule = (r: { id: string } & Rule, order: number): SharingRuleFieldsFragment => ({
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

interface RuleInput {
  grants: { action: string; value: string }[];
  subjectId?: null | string;
  subjectKind: string;
  subjectName: string;
}

const fromInput = (r: RuleInput): Rule => {
  const grants: Rule["grants"] = {};
  for (const g of r.grants) {
    if (ACTIONS.includes(g.action as Action) && (g.value === "allow" || g.value === "deny")) {
      grants[g.action as Action] = g.value;
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

/** The vault refuses a non-admin who adds, removes or changes an everyone rule. */
const everyoneUnchanged = (before: Rule[], after: Rule[]) => {
  const pick = (rules: Rule[]) =>
    rules.filter((r) => r.subjectKind === "everyone").map((r) => JSON.stringify(r.grants));
  return JSON.stringify(pick(before)) === JSON.stringify(pick(after));
};

/** Checks the vault and gateway make on a submitted ruleset; a refusal, or null when it's fine. */
const badRules = (userId: string, before: Rule[], rules: Rule[]) => {
  if (rules.some((r) => r.subjectKind === "group" && !r.subjectId)) {
    return refusal("INVALID_ARGUMENT", "a group rule needs the group's id", "GROUP_ID_REQUIRED");
  }
  if (!isSiteAdmin(userId) && !everyoneUnchanged(before, rules)) {
    return denied("only admins can set everyone rules");
  }
  return null;
};

/** The folder `id` as the user may know it, or undefined. */
const seenFolder = (userId: string, id: string) => {
  const f = folderById(id);
  return f && !hidden(userId, f) ? f : undefined;
};

const seenSecret = (userId: string, id: string) => {
  const s = secretById(id);
  return s && canSee(userId, s) ? s : undefined;
};

const inheritedFrom = (folders: MockFolder[]) =>
  folders.flatMap((f) =>
    world()
      .folderRules.filter((r) => r.folderId === f.id)
      .map((r, index) => ({ fromFolderId: f.id, fromFolderName: f.name, rule: toRule(r, index) })),
  );

const subtreeCount = (id: string): number => {
  const ids = new Set([id]);
  for (let grew = true; grew;) {
    grew = false;
    for (const f of world().folders) {
      if (f.parentId && ids.has(f.parentId) && !ids.has(f.id)) {
        ids.add(f.id);
        grew = true;
      }
    }
  }
  return world().secrets.filter((s) => ids.has(s.folderId)).length;
};

const people = () => USERS.filter((u) => !u.disabled);

export const sharingHandlers = [
  api.query(SharingFoldersDocument, ({ request }) =>
    asUser(request, (userId) =>
      ok({
        folders: world()
          .folders.filter((f) => !hidden(userId, f))
          .map((f) => ({
            id: f.id,
            name: f.name,
            owners: [...f.owners],
            parentId: f.parentId ?? null,
            subtreeSecretCount: resolve(userId, folderChain(f.id)).read.allowed
              ? subtreeCount(f.id)
              : null,
          })),
      }),
    ),
  ),

  api.query(SharingFolderAccessDocument, ({ request, variables }) =>
    asUser(request, (userId) => {
      const f = seenFolder(userId, variables.folderId);
      if (!f) return notFound("folder");
      return ok({
        myFolderAccess: accessOf(resolve(userId, folderChain(f.id)), ownsFolder(userId, f.id)),
      });
    }),
  ),

  api.query(SharingFolderRulesetDocument, ({ request, variables }) =>
    asUser(request, (userId) => {
      const f = seenFolder(userId, variables.folderId);
      if (!f) return notFound("folder");
      if (!resolve(userId, folderChain(f.id)).read.allowed && !ownsFolder(userId, f.id)) {
        return denied("not permitted to view this folder's ruleset");
      }
      const above = chain(f.id).slice(1);
      const own = new Set(f.owners);
      const inheritedOwners: { fromFolderId: string; fromFolderName: string; userId: string }[] =
        [];
      for (const a of above) {
        for (const o of ownersOf(a)) {
          if (own.has(o) || inheritedOwners.some((x) => x.userId === o)) continue;
          inheritedOwners.push({ fromFolderId: a.id, fromFolderName: a.name, userId: o });
        }
      }
      return ok({
        folderRuleset: {
          folderId: f.id,
          inherited: inheritedFrom(above),
          inheritedOwners,
          owners: [...f.owners],
          rules: folderRulesOf(f.id).map((r, index) => toRule(r as MockRaciRule, index)),
        },
        groups: world().groups.map((g) => ({ id: g.id, name: g.name })),
      });
    }),
  ),

  api.query(SharingSecretDocument, ({ request, variables }) =>
    asUser(request, (userId) => {
      const s = seenSecret(userId, variables.secretId);
      return ok({ secret: s ? { folderId: s.folderId, id: s.id, name: s.name } : null });
    }),
  ),

  api.query(SharingSecretAccessDocument, ({ request, variables }) =>
    asUser(request, (userId) => {
      const s = seenSecret(userId, variables.secretId);
      if (!s) return notFound("secret");
      return ok({
        mySecretAccess: accessOf(resolve(userId, secretChain(s)), ownsFolder(userId, s.folderId)),
      });
    }),
  ),

  api.query(SharingSecretRulesetDocument, ({ request, variables }) =>
    asUser(request, (userId) => {
      const s = seenSecret(userId, variables.secretId);
      if (!s) return notFound("secret");
      const r = resolve(userId, secretChain(s));
      if (!r.read.allowed && !r.ack.allowed) {
        return denied("not permitted to view this secret's ruleset");
      }
      return ok({
        groups: world().groups.map((g) => ({ id: g.id, name: g.name })),
        secretRuleset: {
          inherited: inheritedFrom(chain(s.folderId)),
          rules: world()
            .secretRules.filter((x) => x.secretId === s.id)
            .map((x, index) => toRule(x, index)),
          secretId: s.id,
        },
      });
    }),
  ),

  api.query(SharingUserLabelsDocument, ({ request, variables }) =>
    asUser(request, () =>
      ok({
        resolveUserLabels: USERS.filter((u) => [variables.ids].flat().includes(u.id)).map((u) => ({
          id: u.id,
          name: u.name,
        })),
      }),
    ),
  ),

  api.query(SharingSearchUsersDocument, ({ request, variables }) =>
    asUser(request, () => {
      const q = variables.query.trim().toLowerCase();
      const found = people().filter(
        (u) =>
          !q || u.name.toLowerCase().includes(q) || u.username.includes(q) || u.email.includes(q),
      );
      return ok({
        searchUsers: found
          .slice(0, variables.limit ?? 20)
          .map((u) => ({ email: u.email, id: u.id, name: u.name })),
      });
    }),
  ),

  api.query(SharingSimulateFolderDocument, ({ request, variables }) =>
    asUser(request, (userId) => {
      const f = seenFolder(userId, variables.folderId);
      if (!f) return notFound("folder");
      if (!ownsFolder(userId, f.id)) {
        return denied("not permitted to simulate this folder's ruleset");
      }
      if (!userById(variables.userId)) return notFound("user");
      const draft = [variables.draftRules].flat().map((r) => fromInput(r));
      const rulesets = [rulesetOf(f, draft), ...folderChain(f.id).slice(1)];
      return ok({ simulateFolder: decisionOf(resolve(variables.userId, rulesets)) });
    }),
  ),

  api.query(SharingSimulateSecretDocument, ({ request, variables }) =>
    asUser(request, (userId) => {
      const s = seenSecret(userId, variables.secretId);
      if (!s) return notFound("secret");
      if (!ownsFolder(userId, s.folderId)) {
        return denied("not permitted to simulate this secret's ruleset");
      }
      if (!userById(variables.userId)) return notFound("user");
      const draft = [variables.draftRules].flat().map((r) => fromInput(r));
      return ok({ simulateSecret: decisionOf(resolve(variables.userId, secretChain(s, draft))) });
    }),
  ),

  api.mutation(SharingSetFolderRulesetDocument, ({ request, variables }) =>
    asUser(request, (userId) => {
      const f = seenFolder(userId, variables.folderId);
      if (!f) return notFound("folder");
      if (!ownsFolder(userId, f.id)) return notOwner();
      const rules = [variables.rules].flat().map((r) => fromInput(r));
      const bad = badRules(userId, folderRulesOf(f.id), rules);
      if (bad) return bad;
      world().folderRules = [
        ...world().folderRules.filter((r) => r.folderId !== f.id),
        ...rules.map((r) => ({ ...r, folderId: f.id, id: newToken("mock-rule") })),
      ];
      f.owners = [variables.owners].flat();
      return ok({ setFolderRuleset: { folderId: f.id } });
    }),
  ),

  api.mutation(SharingSetSecretRulesetDocument, ({ request, variables }) =>
    asUser(request, (userId) => {
      const s = seenSecret(userId, variables.secretId);
      if (!s) return notFound("secret");
      if (!ownsFolder(userId, s.folderId)) return notOwner();
      const rules = [variables.rules].flat().map((r) => fromInput(r));
      const before = world().secretRules.filter((r) => r.secretId === s.id);
      const bad = badRules(userId, before, rules);
      if (bad) return bad;
      world().secretRules = [
        ...world().secretRules.filter((r) => r.secretId !== s.id),
        ...rules.map((r) => ({ ...r, id: newToken("mock-rule"), secretId: s.id })),
      ];
      return ok({ setSecretRuleset: { secretId: s.id } });
    }),
  ),
];
