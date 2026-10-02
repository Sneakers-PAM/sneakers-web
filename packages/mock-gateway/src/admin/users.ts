import {
  AdminAddGroupMemberDocument,
  AdminConfirmEmailVerificationDocument,
  AdminCreateGroupDocument,
  AdminCreateLocalUserDocument,
  AdminGroupDocument,
  AdminGroupsDocument,
  AdminRemoveGroupMemberDocument,
  AdminRequestEmailVerificationDocument,
  AdminRevokeUserTokenDocument,
  AdminSearchUsersDocument,
  AdminSetUserDisabledDocument,
  AdminSetUserRolesDocument,
  AdminUpdateUserDocument,
  AdminUserDocument,
  AdminUsersDocument,
} from "@sneakers-web/api-client";
import { http, HttpResponse } from "msw";

import { directory, groupsOf, membersOf } from "#mock/admin/directory";
import { isSiteAdmin, notSiteAdmin, refusal } from "#mock/admin/refuse";
import { type MockUser, userById, USERS, WRONG_CODE } from "#mock/fixtures/users";
import { authed, sessionOf } from "#mock/handlers/auth";
import { api, asUser } from "#mock/handlers/graphql";
import { MOCK_GATEWAY_URL, newToken } from "#mock/state";

const view = (u: MockUser) => ({
  disabled: u.disabled,
  email: u.email,
  emailVerified: u.emailVerified,
  id: u.id,
  isRoot: u.isRoot,
  name: u.name,
  roles: u.roles,
  subject: u.isRoot || u.factors.length > 0 ? `kratos-${u.id.slice(10)}` : "",
  username: u.username,
});

const person = (u: MockUser) => ({ email: u.email, id: u.id, name: u.name, username: u.username });

/** Run as a site admin, or answer the way the gateway does for anyone else. */
const asAdmin = <T>(request: Request, run: (actorId: string) => T): T =>
  asUser(request, (actorId) => (isSiteAdmin(actorId) ? run(actorId) : (notSiteAdmin() as T)));

const noUser = () => refusal("NOT_FOUND", "user not found");

/** A data answer for any typed resolver (the fixtures are checked by the page tests). */
const ok = (data: unknown): never => HttpResponse.json({ data } as never) as never;

export const userHandlers = [
  api.query(AdminUsersDocument, ({ request }) =>
    asAdmin(request, () => ok({ users: USERS.map((u) => view(u)) })),
  ),

  api.query(AdminUserDocument, ({ request, variables }) =>
    asAdmin(request, () => {
      const u = userById(variables.id);
      return ok({
        groups: directory.groups,
        user: u ? view(u) : null,
        userGroups: u ? groupsOf(u.id) : [],
        userTokens: directory.tokens
          .filter((t) => t.userId === variables.id)
          .map((t) => ({ ...t, userId: undefined })),
      });
    }),
  ),

  api.mutation(AdminCreateLocalUserDocument, ({ request, variables }) =>
    asAdmin(request, () => {
      const username = variables.username.trim().toLowerCase();
      const email = variables.email.trim().toLowerCase();
      if (!/^[a-z0-9._-]+$/.test(username))
        return refusal(
          "INVALID_ARGUMENT",
          "username may use only lowercase letters, digits, dots, dashes and underscores",
        );
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
        return refusal("INVALID_ARGUMENT", "email is not a valid address");
      if (USERS.some((u) => u.username === username || u.email === email))
        return refusal("ALREADY_EXISTS", "a user with that username or email already exists");
      const u: MockUser = {
        disabled: false,
        email,
        emailVerified: false,
        factors: [],
        id: newToken("mock-user"),
        isRoot: false,
        name: variables.name.trim(),
        roles: [],
        username,
      };
      USERS.push(u);
      return ok({ createLocalUser: { id: u.id } });
    }),
  ),

  api.mutation(AdminUpdateUserDocument, ({ request, variables }) =>
    asAdmin(request, () => {
      const u = userById(variables.userId);
      if (!u) return noUser();
      const email = variables.email.trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
        return refusal("INVALID_ARGUMENT", "email is not a valid address");
      if (
        USERS.some((o) => o.id !== u.id && (o.email === email || o.username === variables.username))
      )
        return refusal("ALREADY_EXISTS", "a user with that username or email already exists");
      if (u.username !== variables.username.trim()) u.emailVerified = false;
      Object.assign(u, { email, name: variables.name.trim(), username: variables.username.trim() });
      return ok({ updateUser: view(u) });
    }),
  ),

  api.mutation(AdminSetUserRolesDocument, ({ request, variables }) =>
    asAdmin(request, () => {
      const u = userById(variables.userId);
      if (!u) return noUser();
      if (u.isRoot && !variables.roles.includes("site-admin"))
        return refusal("FAILED_PRECONDITION", "the root admin always keeps admin access");
      u.roles = [...new Set(variables.roles)];
      return ok({ setUserRoles: view(u) });
    }),
  ),

  api.mutation(AdminSetUserDisabledDocument, ({ request, variables }) =>
    asAdmin(request, (actorId) => {
      const u = userById(variables.userId);
      if (!u) return noUser();
      if (u.isRoot) return refusal("FAILED_PRECONDITION", "the root admin can't be disabled");
      if (u.id === actorId)
        return refusal("FAILED_PRECONDITION", "you can't disable your own account");
      u.disabled = variables.disabled;
      return ok({ setUserDisabled: view(u) });
    }),
  ),

  api.mutation(AdminRequestEmailVerificationDocument, ({ request, variables }) =>
    asAdmin(request, () =>
      userById(variables.userId) ? ok({ requestEmailVerification: true }) : noUser(),
    ),
  ),

  api.mutation(AdminConfirmEmailVerificationDocument, ({ request, variables }) =>
    asAdmin(request, () => {
      const u = userById(variables.userId);
      const good = !!u && variables.code !== WRONG_CODE && /^\d{6}$/.test(variables.code);
      if (good && u) u.emailVerified = true;
      return ok({ confirmEmailVerification: good });
    }),
  ),

  api.mutation(AdminRevokeUserTokenDocument, ({ request, variables }) =>
    asAdmin(request, () => {
      const t = directory.tokens.find(
        (x) => x.id === variables.id && x.userId === variables.userId,
      );
      if (!t) return refusal("NOT_FOUND", "token not found");
      if (!t.revokedAtUnix) t.revokedAtUnix = Math.floor(Date.now() / 1000);
      return ok({ revokeUserToken: { id: t.id, revokedAtUnix: t.revokedAtUnix } });
    }),
  ),

  api.query(AdminGroupsDocument, ({ request }) =>
    asAdmin(request, () => ok({ groups: directory.groups })),
  ),

  api.query(AdminGroupDocument, ({ request, variables }) =>
    asAdmin(request, () =>
      ok({ groupMembers: membersOf(variables.id).map((u) => person(u)), groups: directory.groups }),
    ),
  ),

  api.query(AdminSearchUsersDocument, ({ request, variables }) =>
    asUser(request, () => {
      const q = variables.query.trim().toLowerCase();
      const hits = q
        ? USERS.filter((u) =>
            [u.name, u.username, u.email].some((v) => v.toLowerCase().includes(q)),
          )
        : [];
      return ok({ searchUsers: hits.slice(0, variables.limit ?? 10).map((u) => person(u)) });
    }),
  ),

  api.mutation(AdminCreateGroupDocument, ({ request, variables }) =>
    asAdmin(request, () => {
      const name = variables.name.trim();
      if (!name) return refusal("INVALID_ARGUMENT", "a group needs a name");
      if (directory.groups.some((g) => g.name.toLowerCase() === name.toLowerCase()))
        return refusal("ALREADY_EXISTS", "a group with that name already exists");
      const g = { id: newToken("mock-group"), name };
      directory.groups.push(g);
      return ok({ createGroup: g });
    }),
  ),

  api.mutation(AdminAddGroupMemberDocument, ({ request, variables }) =>
    asAdmin(request, () => {
      if (!userById(variables.userId)) return noUser();
      if (!directory.members.some(([g, u]) => g === variables.groupId && u === variables.userId))
        directory.members.push([variables.groupId, variables.userId]);
      return ok({ addGroupMember: true });
    }),
  ),

  api.mutation(AdminRemoveGroupMemberDocument, ({ request, variables }) =>
    asAdmin(request, () => {
      directory.members = directory.members.filter(
        ([g, u]) => !(g === variables.groupId && u === variables.userId),
      );
      return ok({ removeGroupMember: true });
    }),
  ),

  http.get(`${MOCK_GATEWAY_URL}/auth/mfa/admin/status`, ({ request }) => {
    // A safe read: the gateway checks the session and the admin role, not the CSRF header.
    const s = sessionOf(request);
    if (!s) return HttpResponse.json({ error: "no_session" } as never, { status: 401 });
    if (!isSiteAdmin(s.userId))
      return HttpResponse.json({ error: "admin_required" } as never, { status: 403 });
    const u = userById(new URL(request.url).searchParams.get("userId") ?? "");
    return HttpResponse.json({ enrolled: (u?.factors.length ?? 0) > 0 });
  }),

  http.post(`${MOCK_GATEWAY_URL}/auth/mfa/admin/remove-totp`, async ({ request }) => {
    const s = authed(request);
    if (!s) return HttpResponse.json({ error: "no_session" } as never, { status: 401 });
    if (!isSiteAdmin(s.userId))
      return HttpResponse.json({ error: "admin_required" } as never, { status: 403 });
    const { userId } = (await request.json().catch(() => ({}))) as { userId?: string };
    const u = userById(userId ?? "");
    if (!u) return HttpResponse.json({ error: "invalid_request" } as never, { status: 400 });
    u.factors = u.factors.filter((f) => f !== "totp");
    return HttpResponse.json({ ok: true });
  }),
];
