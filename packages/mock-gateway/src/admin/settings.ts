import {
  AdminDeletePasswordPolicyDocument,
  AdminPoliciesDocument,
  AdminSavePasswordPolicyDocument,
  AdminUpdateSecuritySettingsDocument,
  type PasswordPolicyInput,
} from "@sneakers-web/api-client";
import { HttpResponse } from "msw";

import { isSiteAdmin, notSiteAdmin, refusal } from "#mock/admin/refuse";
import { api, asUser } from "#mock/handlers/graphql";
import { newToken, onMockReset } from "#mock/state";

export interface MockPolicy extends Omit<PasswordPolicyInput, "id"> {
  /** How many type fields use the policy (the vault counts them). */
  byTypeFields: number;
  id: string;
}

export interface MockSecuritySettings {
  allowApiForSensitive: boolean;
  defaultPasswordPolicyId: string;
  requestHistoryRetentionDays: number;
  requireMfaForReveal: boolean;
  requireMfaForSensitiveCheckout: boolean;
  sessionTtlSeconds: number;
}

const policies = (): MockPolicy[] => [
  {
    byTypeFields: 3,
    excludeChars: "\"'\\",
    id: "mock-policy-strong",
    maxLength: 64,
    minLength: 14,
    name: "Strong",
    requireDigit: true,
    requireLower: true,
    requireSymbol: true,
    requireUpper: true,
    rotationDays: 30,
    startClass: "letter",
  },
  {
    byTypeFields: 1,
    id: "mock-policy-pin",
    maxLength: 8,
    minLength: 6,
    name: "PIN",
    requireDigit: true,
    requireLower: false,
    requireSymbol: false,
    requireUpper: false,
    rotationDays: 0,
    startClass: "digit",
  },
  {
    byTypeFields: 0,
    id: "mock-policy-legacy",
    maxLength: 16,
    minLength: 10,
    name: "Legacy app",
    requireDigit: true,
    requireLower: true,
    requireSymbol: false,
    requireUpper: true,
    rotationDays: 90,
    startClass: "any",
  },
];

/** The vault's defaults, with the strong policy as the default for new secrets. */
const security = (): MockSecuritySettings => ({
  allowApiForSensitive: false,
  defaultPasswordPolicyId: "mock-policy-strong",
  requestHistoryRetentionDays: 90,
  requireMfaForReveal: false,
  requireMfaForSensitiveCheckout: true,
  sessionTtlSeconds: 1800,
});

export const settings = { policies: policies(), security: security() };

onMockReset(() => {
  settings.policies = policies();
  settings.security = security();
});

const view = (p: MockPolicy) => {
  const isDefault = settings.security.defaultPasswordPolicyId === p.id;
  return {
    ...p,
    deletable: !isDefault && p.byTypeFields === 0,
    endLiteral: p.endLiteral ?? null,
    excludeChars: p.excludeChars ?? null,
    isDefault,
    maxLength: p.maxLength ?? null,
    rotationDays: p.rotationDays ?? null,
    startClass: p.startClass ?? null,
  };
};

const ok = (data: unknown): never => HttpResponse.json({ data } as never) as never;

const asAdmin = <T>(request: Request, run: () => T): T =>
  asUser(request, (actorId) => (isSiteAdmin(actorId) ? run() : (notSiteAdmin() as T)));

/** The vault's own checks on a policy: a sane length range and at least one usable class. */
const policyProblem = (p: PasswordPolicyInput): null | string => {
  if (!p.name.trim()) return "a policy needs a name";
  if (p.minLength < 1) return "min length must be at least 1";
  if (p.maxLength && p.maxLength < p.minLength) return "max length must be at least the min length";
  const classes = [p.requireUpper, p.requireLower, p.requireDigit, p.requireSymbol].filter(Boolean);
  const room = (p.maxLength || 128) - (p.endLiteral?.length ?? 0);
  if (classes.length > room) return "the length is too short for the classes it requires";
  return null;
};

export const settingsHandlers = [
  api.query(AdminPoliciesDocument, ({ request }) =>
    asAdmin(request, () =>
      ok({
        passwordPolicies: settings.policies.map((p) => view(p)),
        securitySettings: settings.security,
      }),
    ),
  ),

  api.mutation(AdminSavePasswordPolicyDocument, ({ request, variables }) =>
    asAdmin(request, () => {
      const input = variables.input;
      const problem = policyProblem(input);
      if (problem) return refusal("INVALID_ARGUMENT", problem);
      if (
        settings.policies.some(
          (p) => p.id !== input.id && p.name.toLowerCase() === input.name.trim().toLowerCase(),
        )
      )
        return refusal("ALREADY_EXISTS", "a policy with that name already exists");
      const existing = settings.policies.find((p) => p.id === input.id);
      const saved: MockPolicy = {
        ...input,
        byTypeFields: existing?.byTypeFields ?? 0,
        id: existing?.id ?? newToken("mock-policy"),
        name: input.name.trim(),
      };
      settings.policies = existing
        ? settings.policies.map((p) => (p.id === saved.id ? saved : p))
        : [...settings.policies, saved];
      return ok({ savePasswordPolicy: view(saved) });
    }),
  ),

  api.mutation(AdminDeletePasswordPolicyDocument, ({ request, variables }) =>
    asAdmin(request, () => {
      const p = settings.policies.find((x) => x.id === variables.id);
      if (!p) return refusal("NOT_FOUND", "policy not found");
      if (!view(p).deletable)
        return refusal(
          "FAILED_PRECONDITION",
          "the default policy and policies in use can't be deleted",
        );
      settings.policies = settings.policies.filter((x) => x.id !== p.id);
      return ok({ deletePasswordPolicy: true });
    }),
  ),

  api.mutation(AdminUpdateSecuritySettingsDocument, ({ request, variables }) =>
    asAdmin(request, () => {
      const input = Object.fromEntries(
        Object.entries(variables.input).filter(([, v]) => v !== undefined && v !== null),
      ) as Partial<MockSecuritySettings>;
      if (
        input.sessionTtlSeconds !== undefined &&
        (input.sessionTtlSeconds < 900 || input.sessionTtlSeconds > 3600)
      )
        return refusal("INVALID_ARGUMENT", "the session timeout must be between 15 and 60 minutes");
      if (input.requestHistoryRetentionDays !== undefined && input.requestHistoryRetentionDays < 1)
        return refusal("INVALID_ARGUMENT", "keep resolved requests for at least 1 day");
      if (
        input.defaultPasswordPolicyId &&
        !settings.policies.some((p) => p.id === input.defaultPasswordPolicyId)
      )
        return refusal("NOT_FOUND", "policy not found");
      settings.security = { ...settings.security, ...input };
      return ok({ updateSecuritySettings: settings.security });
    }),
  ),
];
