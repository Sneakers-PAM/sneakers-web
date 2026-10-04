import type { RequestHandler } from "msw";

import {
  CheckoutsActiveLeaseDocument,
  CheckoutsCheckinDocument,
  CheckoutsCheckoutDocument,
  CheckoutsMineDocument,
  RequestsCommentDocument,
  RequestsCreateDocument,
  RequestsListDocument,
  RequestsPeopleDocument,
  RequestsResolveDocument,
  RequestsSecretDocument,
} from "@sneakers-web/api-client";
import { HttpResponse } from "msw";

import type { MockLease, MockRequest } from "#mock/fixtures/world";

import { isSiteAdmin, refusal } from "#mock/admin/refuse";
import { userById, USERS } from "#mock/fixtures/users";
import { api, asUser } from "#mock/handlers/graphql";
import {
  activeLease,
  canApprove,
  canRead,
  canSee,
  chain,
  secretById,
} from "#mock/handlers/staff/access";
import { recordMove } from "#mock/handlers/staff/moves";
import { mockState, newToken } from "#mock/state";

const HOUR = 3_600_000;
// The workflow's windows: a check-out without hours gets 4, an approval without hours 8, at most 24.
const CHECKOUT_DEFAULT_HOURS = 4;
const GRANT_DEFAULT_HOURS = 8;
const GRANT_MAX_HOURS = 24;

const ok = (data: unknown): never => HttpResponse.json({ data } as never) as never;

const world = () => mockState.world;
const nameOf = (userId: string) => userById(userId)?.name ?? userId;

const folderPath = (folderId: string) =>
  chain(folderId)
    .toReversed()
    .map((f) => f.name)
    .join(" / ");

const isMove = (r: MockRequest) => r.kind !== "secret_access";

const view = (r: MockRequest) => ({
  ...r,
  comments: r.comments.map((c) => ({ ...c })),
  reason: r.reason ?? null,
  resolvedAt: r.resolvedAt ?? null,
  resolvedByUserId: r.resolvedByUserId ?? null,
  resolvedByUserName: r.resolvedByUserName ?? null,
});

const leaseView = (l: MockLease) => ({ ...l });

const notFound = () => refusal("NOT_FOUND", "approval request not found");

export const requestsHandlers: RequestHandler[] = [
  api.query(RequestsListDocument, ({ request }) =>
    asUser(request, () => ok({ approvalRequests: world().requests.map((r) => view(r)) })),
  ),

  api.query(RequestsSecretDocument, ({ request, variables }) =>
    asUser(request, (userId) => {
      const s = secretById(variables.id);
      if (!s || !canSee(userId, s))
        return ok({ mySecretAccess: { approve: false, read: false }, secret: null });
      return ok({
        mySecretAccess: { approve: canApprove(userId, s), read: canRead(userId, s) },
        secret: { folderId: s.folderId, id: s.id, name: s.name, typeId: s.typeId },
      });
    }),
  ),

  api.query(RequestsPeopleDocument, ({ request, variables }) =>
    asUser(request, () => {
      const ids = [variables.ids].flat();
      return ok({
        resolveUserLabels: USERS.filter((u) => ids.includes(u.id))
          .toSorted((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))
          .map((u) => ({ id: u.id, name: u.name })),
      });
    }),
  ),

  api.mutation(RequestsResolveDocument, ({ request, variables }) =>
    asUser(request, (userId) => {
      const r = world().requests.find((x) => x.id === variables.id);
      if (!r) return notFound();
      if (r.requestedByUserId === userId)
        return refusal("PERMISSION_DENIED", "you can't resolve your own request", "SELF_APPROVAL");
      if (isMove(r) && !isSiteAdmin(userId))
        return refusal(
          "PERMISSION_DENIED",
          "a move request is resolved by a site admin",
          "NOT_APPROVER",
        );
      const s = secretById(r.secretId);
      if (!isMove(r) && (!s || !canApprove(userId, s)))
        return refusal(
          "PERMISSION_DENIED",
          "you can't approve requests for this secret",
          "NOT_APPROVER",
        );
      // The workflow service doesn't refuse this yet; the mock does, so the screen's answer can be
      // tried. The reason is the mock's own until the workflow sends one.
      if (r.status !== "pending")
        return refusal(
          "FAILED_PRECONDITION",
          `the request was already ${r.status}`,
          "REQUEST_NOT_PENDING",
        );
      const held = activeLease(r.secretId);
      if (variables.approve && !isMove(r) && held && held.userId !== r.requestedByUserId)
        return refusal(
          "FAILED_PRECONDITION",
          "the secret is checked out; approve once it's checked in",
          "CHECKOUT_LEASE_HELD",
          { holder_user_id: held.userId },
        );

      const now = Date.now();
      r.status = variables.approve ? "approved" : "denied";
      r.resolvedAt = new Date(now).toISOString();
      r.resolvedByUserId = userId;
      r.resolvedByUserName = nameOf(userId);
      if (variables.approve && r.kind === "folder_move") {
        const f = world().folders.find((x) => x.id === r.folderId);
        if (f) f.parentId = r.destParentId;
      } else if (variables.approve && r.kind === "secret_move") {
        if (s && r.destParentId && r.destParentId !== s.folderId)
          recordMove(s, userId, r.destParentId);
      } else if (variables.approve && !held) {
        const asked = variables.grantHours ?? 0;
        const hours = Math.min(asked > 0 ? asked : GRANT_DEFAULT_HOURS, GRANT_MAX_HOURS);
        world().leases.push({
          expiresAt: new Date(now + hours * HOUR).toISOString(),
          id: newToken("mock-lease"),
          issuedAt: new Date(now).toISOString(),
          returned: false,
          secretId: r.secretId,
          userId: r.requestedByUserId,
        });
      }
      return ok({ resolveApproval: view(r) });
    }),
  ),

  api.mutation(RequestsCommentDocument, ({ request, variables }) =>
    asUser(request, (userId) => {
      const r = world().requests.find((x) => x.id === variables.requestId);
      if (!r) return notFound();
      const body = variables.body.trim();
      if (!body) return refusal("INVALID_ARGUMENT", "a message needs some text");
      r.comments.push({
        authorName: nameOf(userId),
        authorUserId: userId,
        body,
        createdAt: new Date().toISOString(),
        id: newToken("mock-comment"),
      });
      return ok({ addApprovalComment: view(r) });
    }),
  ),

  api.mutation(RequestsCreateDocument, ({ request, variables }) =>
    asUser(request, (userId) => {
      const s = secretById(variables.secretId);
      if (!s) return refusal("NOT_FOUND", "secret not found");
      const r: MockRequest = {
        comments: [],
        destParentId: "",
        destParentName: "",
        folderId: s.folderId,
        folderName: folderPath(s.folderId),
        id: newToken("mock-req"),
        kind: "secret_access",
        reason: variables.reason?.trim() || undefined,
        requestedAt: new Date().toISOString(),
        requestedByUserId: userId,
        secretId: s.id,
        status: "pending",
      };
      world().requests.push(r);
      return ok({ createAccessRequest: view(r) });
    }),
  ),

  api.query(CheckoutsMineDocument, ({ request, variables }) =>
    asUser(request, () =>
      ok({
        activeLeasesForUser: world()
          .leases.filter((l) => l.userId === variables.userId && !l.returned)
          .map((l) => leaseView(l)),
      }),
    ),
  ),

  api.query(CheckoutsActiveLeaseDocument, ({ request, variables }) =>
    asUser(request, () => {
      const l = activeLease(variables.secretId);
      return ok({ activeLease: l ? leaseView(l) : null });
    }),
  ),

  api.mutation(CheckoutsCheckoutDocument, ({ request, variables }) =>
    asUser(request, (userId) => {
      const s = secretById(variables.secretId);
      if (!s || !canRead(userId, s))
        return refusal(
          "PERMISSION_DENIED",
          "you have no access to this secret",
          "CHECKOUT_NO_ACCESS",
        );
      const type = world().secretTypes.find((t) => t.id === s.typeId);
      if (!type?.checkout)
        return refusal(
          "FAILED_PRECONDITION",
          "this secret's type doesn't allow check-out",
          "CHECKOUT_TYPE_DISABLED",
        );
      const held = activeLease(s.id);
      if (held)
        return refusal(
          "FAILED_PRECONDITION",
          held.userId === userId
            ? "you already have this secret checked out"
            : "this secret is checked out by someone else",
          "CHECKOUT_LEASE_HELD",
          { holder_user_id: held.userId },
        );
      const now = Date.now();
      const asked = variables.hours ?? 0;
      const lease: MockLease = {
        expiresAt: new Date(
          now + (asked > 0 ? asked : CHECKOUT_DEFAULT_HOURS) * HOUR,
        ).toISOString(),
        id: newToken("mock-lease"),
        issuedAt: new Date(now).toISOString(),
        returned: false,
        secretId: s.id,
        userId,
      };
      world().leases.push(lease);
      return ok({ checkoutSecret: leaseView(lease) });
    }),
  ),

  api.mutation(CheckoutsCheckinDocument, ({ request, variables }) =>
    asUser(request, (userId) => {
      const held = activeLease(variables.secretId);
      if (held && held.userId !== userId)
        return refusal(
          "PERMISSION_DENIED",
          "only the lease holder can check this secret in",
          "CHECKIN_NOT_HOLDER",
        );
      if (held) held.returned = true;
      return ok({ checkinSecret: true });
    }),
  ),
];
