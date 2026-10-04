import {
  SharingFolderAccessDocument,
  SharingFolderRulesetDocument,
  SharingFoldersDocument,
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

import { USERS } from "#mock/fixtures/users";
import { api, asUser } from "#mock/handlers/graphql";
import {
  folderAccess,
  folderChain,
  folderRuleset,
  hidden,
  type Outcome,
  resolve,
  secretAccess,
  secretRuleset,
  setFolderRuleset,
  setSecretRuleset,
  simulateFolder,
  simulateSecret,
} from "#mock/handlers/raci";
import { canSee, secretById } from "#mock/handlers/staff/access";
import { mockState } from "#mock/state";

/*
 * Mock answers for sharing (S8): folder and secret RACI rulesets, the simulator and the people
 * picker. Every decision comes from the shared resolver in handlers/raci.ts, the same one the
 * browse page, the secret page and the admin console use.
 */

const ok = <T>(data: T) => HttpResponse.json({ data }) as never;
const world = () => mockState.world;
const groups = () => world().groups.map((g) => ({ id: g.id, name: g.name }));

/** Answer `key` with an outcome's value, or the refusal it carries. */
const answer = <T>(key: string, o: Outcome<T>, extra: Record<string, unknown> = {}) =>
  o.ok ? ok({ [key]: o.value, ...extra }) : o.refusal;

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
    asUser(request, (userId) => answer("myFolderAccess", folderAccess(userId, variables.folderId))),
  ),

  api.query(SharingFolderRulesetDocument, ({ request, variables }) =>
    asUser(request, (userId) =>
      answer("folderRuleset", folderRuleset(userId, variables.folderId), { groups: groups() }),
    ),
  ),

  api.query(SharingSecretDocument, ({ request, variables }) =>
    asUser(request, (userId) => {
      const s = secretById(variables.secretId);
      const seen = s && canSee(userId, s) ? s : undefined;
      return ok({
        secret: seen ? { folderId: seen.folderId, id: seen.id, name: seen.name } : null,
      });
    }),
  ),

  api.query(SharingSecretAccessDocument, ({ request, variables }) =>
    asUser(request, (userId) => answer("mySecretAccess", secretAccess(userId, variables.secretId))),
  ),

  api.query(SharingSecretRulesetDocument, ({ request, variables }) =>
    asUser(request, (userId) =>
      answer("secretRuleset", secretRuleset(userId, variables.secretId), { groups: groups() }),
    ),
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
    asUser(request, (userId) =>
      answer(
        "simulateFolder",
        simulateFolder(userId, variables.folderId, variables.userId, [variables.draftRules].flat()),
      ),
    ),
  ),

  api.query(SharingSimulateSecretDocument, ({ request, variables }) =>
    asUser(request, (userId) =>
      answer(
        "simulateSecret",
        simulateSecret(userId, variables.secretId, variables.userId, [variables.draftRules].flat()),
      ),
    ),
  ),

  api.mutation(SharingSetFolderRulesetDocument, ({ request, variables }) =>
    asUser(request, (userId) =>
      answer(
        "setFolderRuleset",
        setFolderRuleset(
          userId,
          variables.folderId,
          [variables.owners].flat(),
          [variables.rules].flat(),
        ),
      ),
    ),
  ),

  api.mutation(SharingSetSecretRulesetDocument, ({ request, variables }) =>
    asUser(request, (userId) =>
      answer(
        "setSecretRuleset",
        setSecretRuleset(userId, variables.secretId, [variables.rules].flat()),
      ),
    ),
  ),
];
