import type { RequestHandler } from "msw";

import { SecretMovesDocument } from "@sneakers-web/api-client";
import { HttpResponse } from "msw";

import type { MockSecret } from "#mock/fixtures/world";

import { refusal } from "#mock/admin/refuse";
import { userById } from "#mock/fixtures/users";
import { api, asUser } from "#mock/handlers/graphql";
import { canRead, canSee, secretById } from "#mock/handlers/staff/access";

/*
 * A secret's folder moves. The gateway reads them from the audit trail behind the same check as
 * the version history, so a move never mints a version and only readers see it.
 */

/** Move `s` to `toFolderId` and keep the move for its history. */
export const recordMove = (s: MockSecret, userId: string, toFolderId: string) => {
  s.moves.unshift({
    fromFolderId: s.folderId,
    movedAt: new Date().toISOString(),
    movedBy: userId,
    movedByName: userById(userId)?.name ?? userId,
    toFolderId,
  });
  s.folderId = toFolderId;
};

export const movesHandlers: RequestHandler[] = [
  api.query(SecretMovesDocument, ({ request, variables }) =>
    asUser(request, (userId) => {
      const s = secretById(variables.secretId);
      if (!s || !canSee(userId, s)) return refusal("NOT_FOUND", "secret not found");
      if (!canRead(userId, s))
        return refusal("PERMISSION_DENIED", "not permitted to read this secret", "NO_ACCESS");
      return HttpResponse.json({ data: { secretMoves: s.moves.map((m) => ({ ...m })) } }) as never;
    }),
  ),
];
