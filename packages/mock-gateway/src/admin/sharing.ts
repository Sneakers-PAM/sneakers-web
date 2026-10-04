import {
  AdminFolderRulesetDocument,
  AdminSetFolderRulesetDocument,
} from "@sneakers-web/api-client";
import { HttpResponse } from "msw";

import { groups } from "#mock/admin/directory";
import { USERS } from "#mock/fixtures/users";
import { api, asUser } from "#mock/handlers/graphql";
import { folderRuleset, setFolderRuleset } from "#mock/handlers/raci";

const ok = (data: unknown): never => HttpResponse.json({ data } as never) as never;

/** A folder's sharing for the admin console, through the shared RACI model. */
export const sharingHandlers = [
  api.query(AdminFolderRulesetDocument, ({ request, variables }) =>
    asUser(request, (actorId) => {
      const o = folderRuleset(actorId, variables.folderId);
      return o.ok
        ? ok({
            folderRuleset: o.value,
            groups: groups(),
            users: USERS.map((u) => ({ id: u.id, name: u.name })),
          })
        : o.refusal;
    }),
  ),

  api.mutation(AdminSetFolderRulesetDocument, ({ request, variables }) =>
    asUser(request, (actorId) => {
      const o = setFolderRuleset(
        actorId,
        variables.folderId,
        [variables.owners].flat(),
        [variables.rules].flat(),
      );
      return o.ok ? ok({ setFolderRuleset: { folderId: o.value.folderId } }) : o.refusal;
    }),
  ),
];
