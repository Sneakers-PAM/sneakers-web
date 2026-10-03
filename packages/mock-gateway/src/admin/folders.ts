import {
  AdminFolderSettingsDocument,
  AdminSetFolderRevealStepUpDocument,
} from "@sneakers-web/api-client";
import { HttpResponse } from "msw";

import { isSiteAdmin, notSiteAdmin, refusal } from "#mock/admin/refuse";
import { settings } from "#mock/admin/settings";
import { USERS } from "#mock/fixtures/users";
import { api, asUser } from "#mock/handlers/graphql";
import { mockState } from "#mock/state";

const ok = (data: unknown): never => HttpResponse.json({ data } as never) as never;

export const folderHandlers = [
  api.query(AdminFolderSettingsDocument, ({ request }) =>
    asUser(request, (actorId) =>
      isSiteAdmin(actorId)
        ? ok({
            folders: mockState.world.folders.map((f) => ({
              id: f.id,
              revealStepUp: f.revealStepUp ?? "inherit",
            })),
            securitySettings: { requireMfaForReveal: settings.security.requireMfaForReveal },
            users: USERS.map((u) => ({ id: u.id, name: u.name })),
          })
        : notSiteAdmin(),
    ),
  ),

  // Only a site admin sets a folder's override, as the vault enforces.
  api.mutation(AdminSetFolderRevealStepUpDocument, ({ request, variables }) =>
    asUser(request, (actorId) => {
      if (!isSiteAdmin(actorId)) return notSiteAdmin();
      const f = mockState.world.folders.find((x) => x.id === variables.folderId);
      if (!f) return refusal("NOT_FOUND", "folder not found");
      f.revealStepUp = variables.mode === "inherit" ? undefined : variables.mode;
      return ok({ setFolderRevealStepUp: { id: f.id, revealStepUp: variables.mode } });
    }),
  ),
];
