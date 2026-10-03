import {
  AdminCreateServiceAccountDocument,
  AdminDisableServiceAccountDocument,
  AdminLinkOidcClientDocument,
  AdminMintApiTokenDocument,
  AdminRevokeApiTokenDocument,
  AdminServiceAccountDocument,
  AdminServiceAccountsDocument,
  AdminUnlinkOidcClientDocument,
} from "@sneakers-web/api-client";
import { HttpResponse } from "msw";

import { groups } from "#mock/admin/directory";
import { isSiteAdmin, notSiteAdmin, refusal } from "#mock/admin/refuse";
import { USERS } from "#mock/fixtures/users";
import { api, asUser } from "#mock/handlers/graphql";
import { newToken, onMockReset } from "#mock/state";

/** The gateway's own Hydra issuer: a link's issuer is always this, never typed in. */
export const MOCK_HYDRA_ISSUER = "https://auth.example.org/";

interface MockApiToken {
  createdBy: string;
  expiresAtUnix: number;
  id: string;
  lastUsedAtUnix: number;
  revokedAtUnix: number;
  scope: string;
  serviceAccountId: string;
}

interface MockServiceAccount {
  createdAtUnix: number;
  createdBy: string;
  description: string;
  disabled: boolean;
  id: string;
  name: string;
  oidcAllowedGroups: string[];
  oidcSubject?: string;
}

const DAY = 86_400;
const now = () => Math.floor(Date.now() / 1000);

const accounts = (): MockServiceAccount[] => {
  const t = now();
  return [
    {
      createdAtUnix: t - 49 * DAY,
      createdBy: "mock-user-carol",
      description: "Builds and deploys the web app. Owner: Platform engineers.",
      disabled: false,
      id: "mock-sa-ci",
      name: "CI Pipeline",
      oidcAllowedGroups: ["mock-group-platform"],
      oidcSubject: "ci-runner",
    },
    {
      createdAtUnix: t - 120 * DAY,
      createdBy: "mock-user-alice",
      description: "Nightly database backups.",
      disabled: false,
      id: "mock-sa-backup",
      name: "Backup job",
      oidcAllowedGroups: [],
    },
    {
      createdAtUnix: t - 300 * DAY,
      createdBy: "mock-user-carol",
      description: "Replaced by the CI pipeline.",
      disabled: true,
      id: "mock-sa-legacy",
      name: "Legacy deploy script",
      oidcAllowedGroups: [],
    },
  ];
};

const tokens = (): MockApiToken[] => {
  const t = now();
  return [
    {
      createdBy: "mock-user-carol",
      expiresAtUnix: t + 28 * DAY,
      id: "mock-apitoken-1",
      lastUsedAtUnix: t - 120,
      revokedAtUnix: 0,
      scope: "mock-group-platform",
      serviceAccountId: "mock-sa-ci",
    },
    {
      createdBy: "mock-user-carol",
      expiresAtUnix: 0,
      id: "mock-apitoken-2",
      lastUsedAtUnix: t - DAY,
      revokedAtUnix: 0,
      scope: "mock-group-platform mock-group-db",
      serviceAccountId: "mock-sa-ci",
    },
    {
      createdBy: "mock-user-alice",
      expiresAtUnix: t - 30 * DAY,
      id: "mock-apitoken-3",
      lastUsedAtUnix: t - 40 * DAY,
      revokedAtUnix: 0,
      scope: "mock-group-platform",
      serviceAccountId: "mock-sa-ci",
    },
    {
      createdBy: "mock-user-alice",
      expiresAtUnix: t + 200 * DAY,
      id: "mock-apitoken-4",
      lastUsedAtUnix: t - 8 * 3600,
      revokedAtUnix: 0,
      scope: "mock-group-db",
      serviceAccountId: "mock-sa-backup",
    },
  ];
};

const machine = { accounts: accounts(), tokens: tokens() };

onMockReset(() => {
  machine.accounts = accounts();
  machine.tokens = tokens();
});

const view = (a: MockServiceAccount) => ({
  createdAtUnix: a.createdAtUnix,
  createdBy: a.createdBy,
  description: a.description,
  disabled: a.disabled,
  id: a.id,
  name: a.name,
  oidcAllowedGroups: a.oidcAllowedGroups,
  oidcIssuer: a.oidcSubject ? MOCK_HYDRA_ISSUER : null,
  oidcSubject: a.oidcSubject ?? null,
});

const ok = (data: unknown): never => HttpResponse.json({ data } as never) as never;

const asAdmin = <T>(request: Request, run: (actorId: string) => T): T =>
  asUser(request, (actorId) => (isSiteAdmin(actorId) ? run(actorId) : (notSiteAdmin() as T)));

const slug = (name: string) => name.trim().toLowerCase().replaceAll(/\s+/g, "-");

/** A group by id, exact name or name slug, as identity resolves scope entries. */
const resolveGroup = (entry: string) =>
  groups().filter((g) => g.id === entry || g.name === entry || slug(g.name) === entry);

const canonical = (entries: string[]): { problem: string } | string[] => {
  const ids: string[] = [];
  for (const entry of entries) {
    const hits = resolveGroup(entry);
    if (hits.length !== 1) return { problem: `"${entry}" doesn't name exactly one group` };
    ids.push((hits[0] as { id: string }).id);
  }
  return [...new Set(ids)];
};

const people = () => USERS.map((u) => ({ id: u.id, name: u.name }));

export const serviceAccountHandlers = [
  api.query(AdminServiceAccountsDocument, ({ request }) =>
    asAdmin(request, () =>
      ok({ serviceAccounts: machine.accounts.map((a) => view(a)), users: people() }),
    ),
  ),

  api.query(AdminServiceAccountDocument, ({ request, variables }) =>
    asAdmin(request, () =>
      ok({
        apiTokens: machine.tokens.filter((t) => t.serviceAccountId === variables.id),
        groups: groups(),
        serviceAccounts: machine.accounts.map((a) => view(a)),
        users: people(),
      }),
    ),
  ),

  api.mutation(AdminCreateServiceAccountDocument, ({ request, variables }) =>
    asAdmin(request, (actorId) => {
      const name = variables.name.trim();
      if (!name) return refusal("INVALID_ARGUMENT", "a service account needs a name");
      if (machine.accounts.some((a) => a.name.toLowerCase() === name.toLowerCase()))
        return refusal("ALREADY_EXISTS", "a service account with that name already exists");
      const a: MockServiceAccount = {
        createdAtUnix: now(),
        createdBy: actorId,
        description: variables.description.trim(),
        disabled: false,
        id: newToken("mock-sa"),
        name,
        oidcAllowedGroups: [],
      };
      machine.accounts.push(a);
      return ok({ createServiceAccount: { id: a.id } });
    }),
  ),

  api.mutation(AdminDisableServiceAccountDocument, ({ request, variables }) =>
    asAdmin(request, () => {
      const a = machine.accounts.find((x) => x.id === variables.id);
      if (!a) return refusal("NOT_FOUND", "service account not found");
      a.disabled = true;
      return ok({ disableServiceAccount: { disabled: true, id: a.id } });
    }),
  ),

  api.mutation(AdminMintApiTokenDocument, ({ request, variables }) =>
    asAdmin(request, (actorId) => {
      const a = machine.accounts.find((x) => x.id === variables.serviceAccountId);
      if (!a) return refusal("NOT_FOUND", "service account not found");
      if (a.disabled) return refusal("FAILED_PRECONDITION", "service account is disabled");
      const entries = variables.scope.split(/\s+/).filter(Boolean);
      if (entries.length === 0)
        return refusal("INVALID_ARGUMENT", "a token needs at least one group in its scope");
      const scope = canonical(entries);
      if ("problem" in scope) return refusal("INVALID_ARGUMENT", scope.problem);
      const t: MockApiToken = {
        createdBy: actorId,
        expiresAtUnix: variables.expiresAt ?? 0,
        id: newToken("mock-apitoken"),
        lastUsedAtUnix: 0,
        revokedAtUnix: 0,
        scope: scope.join(" "),
        serviceAccountId: a.id,
      };
      machine.tokens.push(t);
      // Plainly fake: the mock never makes anything that looks like a usable credential.
      return ok({
        mintApiToken: { apiToken: t, token: `mock-sa-token-${newToken("x").slice(2)}` },
      });
    }),
  ),

  api.mutation(AdminRevokeApiTokenDocument, ({ request, variables }) =>
    asAdmin(request, () => {
      const t = machine.tokens.find((x) => x.id === variables.id);
      if (!t) return refusal("NOT_FOUND", "token not found");
      if (!t.revokedAtUnix) t.revokedAtUnix = now();
      return ok({ revokeApiToken: { id: t.id, revokedAtUnix: t.revokedAtUnix } });
    }),
  ),

  api.mutation(AdminLinkOidcClientDocument, ({ request, variables }) =>
    asAdmin(request, () => {
      const a = machine.accounts.find((x) => x.id === variables.serviceAccountId);
      if (!a) return refusal("NOT_FOUND", "service account not found");
      if (!variables.oidcSubject.trim())
        return refusal("INVALID_ARGUMENT", "the client ID is required");
      const allowed = canonical([variables.allowedGroups].flat());
      if ("problem" in allowed) return refusal("INVALID_ARGUMENT", allowed.problem);
      a.oidcSubject = variables.oidcSubject.trim();
      a.oidcAllowedGroups = allowed;
      return ok({ linkOidcClient: view(a) });
    }),
  ),

  api.mutation(AdminUnlinkOidcClientDocument, ({ request, variables }) =>
    asAdmin(request, () => {
      const a = machine.accounts.find((x) => x.id === variables.serviceAccountId);
      if (!a) return refusal("NOT_FOUND", "service account not found");
      a.oidcSubject = undefined;
      a.oidcAllowedGroups = [];
      return ok({ unlinkOidcClient: view(a) });
    }),
  ),
];
