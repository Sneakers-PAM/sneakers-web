import {
  AdminCloneSecretTypeDocument,
  AdminCreateSecretTypeDocument,
  AdminDeleteSecretTypeDocument,
  AdminImportExtensionDocument,
  AdminImportExtensionFromJsonDocument,
  AdminSecretTypeDocument,
  AdminSecretTypesDocument,
  AdminUpdateSecretTypeDocument,
  type SecretTypeInput,
} from "@sneakers-web/api-client";
import { HttpResponse } from "msw";

import type { MockFieldDefinition, MockSecretType } from "#mock/fixtures/world";

import { isSiteAdmin, notSiteAdmin, refusal } from "#mock/admin/refuse";
import { settings } from "#mock/admin/settings";
import { api, asUser } from "#mock/handlers/graphql";
import { mockState, newToken, onMockReset } from "#mock/state";

type Field = MockFieldDefinition;
type MockType = MockSecretType;

/** A type's fields as the vault stores them: GraphQL's nulls become absent. */
const stored = (fields: SecretTypeInput["fields"]): Field[] =>
  fields.map(
    (f) =>
      Object.fromEntries(
        Object.entries(f).filter(([, v]) => v !== null && v !== undefined),
      ) as unknown as Field,
  );

/** Packs the vault offers but this install hasn't installed. */
const packs = (): MockType[] => [
  {
    fields: [
      { key: "pin", kind: "password", label: "Device PIN", sensitive: true },
      { key: "camera", kind: "text", label: "Camera admin" },
      { key: "psk", kind: "sensitive", label: "Wi-Fi PSK", sensitive: true },
    ],
    id: "mock-pack-iot",
    name: "Generic IoT",
    origin: "extension",
    vendor: "Generic",
  },
  {
    fields: [
      { key: "terminal", kind: "text", label: "Terminal admin" },
      {
        key: "merchantPin",
        kind: "password",
        label: "Merchant PIN",
        sensitive: true,
        superSensitive: true,
      },
    ],
    id: "mock-pack-payments",
    name: "Payment terminals",
    origin: "extension",
    vendor: "Payments",
  },
];

/** Packs not installed yet. The installed types live in the shared mock world. */
export const catalogue = { packs: packs() };

onMockReset(() => {
  catalogue.packs = packs();
});

/** How many secrets use a type: the vault refuses to delete a type in use. */
const usedBy = (typeId: string) =>
  mockState.world.secrets.filter((x) => x.typeId === typeId).length;

const nulls = (f: Field) => ({
  defaultValue: null,
  maxLength: null,
  options: null,
  pattern: null,
  policyEnforcement: null,
  policyId: null,
  required: null,
  rotates: null,
  sensitive: null,
  superSensitive: null,
  ...f,
});

const view = (t: MockType) => ({
  checkout: t.checkout ?? false,
  fields: t.fields.map((f) => nulls(f)),
  heartbeat: t.heartbeat ?? false,
  id: t.id,
  name: t.name,
  origin: t.origin,
  rotation: t.rotation ?? false,
  vendor: t.vendor ?? null,
});

const ok = (data: unknown): never => HttpResponse.json({ data } as never) as never;

const asAdmin = <T>(request: Request, run: () => T): T =>
  asUser(request, (actorId) => (isSiteAdmin(actorId) ? run() : (notSiteAdmin() as T)));

const typeProblem = (input: SecretTypeInput): null | string => {
  if (!input.name.trim()) return "a type needs a name";
  const keys = new Set<string>();
  for (const [index, f] of input.fields.entries()) {
    if (!f.label.trim()) return `field ${index + 1} needs a label`;
    if (keys.has(f.key)) return `two fields share the key ${f.key}`;
    keys.add(f.key);
    if (f.kind === "select" && (f.options ?? []).filter(Boolean).length === 0)
      return `field ${index + 1} is a select with no options`;
    if (f.pattern) {
      try {
        new RegExp(f.pattern);
      } catch {
        return `field ${index + 1} has a pattern that isn't a valid regular expression`;
      }
    }
  }
  return null;
};

const byName = (name: string, except?: string) =>
  mockState.world.secretTypes.some(
    (t) => t.id !== except && t.name.toLowerCase() === name.trim().toLowerCase(),
  );

export const typeHandlers = [
  api.query(AdminSecretTypesDocument, ({ request }) =>
    asAdmin(request, () =>
      ok({
        availableExtensions: catalogue.packs.map((p) => ({
          fields: p.fields.map((f) => ({ label: f.label })),
          id: p.id,
          name: p.name,
          vendor: p.vendor ?? null,
        })),
        secretTypes: mockState.world.secretTypes.map((t) => view(t)),
      }),
    ),
  ),

  api.query(AdminSecretTypeDocument, ({ request }) =>
    asAdmin(request, () =>
      ok({
        passwordPolicies: settings.policies.map((p) => ({
          id: p.id,
          isDefault: p.id === settings.security.defaultPasswordPolicyId,
          maxLength: p.maxLength ?? null,
          minLength: p.minLength,
          name: p.name,
        })),
        secretTypes: mockState.world.secretTypes.map((t) => view(t)),
      }),
    ),
  ),

  api.mutation(AdminCreateSecretTypeDocument, ({ request, variables }) =>
    asAdmin(request, () => {
      const problem = typeProblem(variables.input);
      if (problem) return refusal("INVALID_ARGUMENT", problem);
      if (byName(variables.input.name))
        return refusal("ALREADY_EXISTS", "a type with that name already exists");
      const t: MockType = {
        ...variables.input,
        checkout: !!variables.input.checkout,
        fields: stored(variables.input.fields),
        heartbeat: !!variables.input.heartbeat,
        id: newToken("mock-type"),
        name: variables.input.name.trim(),
        origin: "custom",
        rotation: !!variables.input.rotation,
      };
      mockState.world.secretTypes.push(t);
      return ok({ createSecretType: view(t) });
    }),
  ),

  api.mutation(AdminUpdateSecretTypeDocument, ({ request, variables }) =>
    asAdmin(request, () => {
      const t = mockState.world.secretTypes.find((x) => x.id === variables.id);
      if (!t) return refusal("NOT_FOUND", "type not found");
      if (t.origin !== "custom")
        return refusal(
          "FAILED_PRECONDITION",
          "built-in and extension types are read-only; clone it to change it",
        );
      const problem = typeProblem(variables.input);
      if (problem) return refusal("INVALID_ARGUMENT", problem);
      if (byName(variables.input.name, t.id))
        return refusal("ALREADY_EXISTS", "a type with that name already exists");
      Object.assign(t, {
        ...variables.input,
        fields: stored(variables.input.fields),
        name: variables.input.name.trim(),
      });
      return ok({ updateSecretType: view(t) });
    }),
  ),

  api.mutation(AdminDeleteSecretTypeDocument, ({ request, variables }) =>
    asAdmin(request, () => {
      const t = mockState.world.secretTypes.find((x) => x.id === variables.id);
      if (!t) return refusal("NOT_FOUND", "type not found");
      if (t.origin === "system")
        return refusal("FAILED_PRECONDITION", "built-in types can't be deleted");
      const used = usedBy(t.id);
      if (used > 0) return refusal("FAILED_PRECONDITION", `${used} secrets use this type`);
      mockState.world.secretTypes = mockState.world.secretTypes.filter((x) => x.id !== t.id);
      if (
        t.origin === "extension" &&
        t.vendor &&
        !mockState.world.secretTypes.some((x) => x.vendor === t.vendor)
      )
        catalogue.packs.push({ ...t, id: newToken("mock-pack") });
      return ok({ deleteSecretType: true });
    }),
  ),

  api.mutation(AdminCloneSecretTypeDocument, ({ request, variables }) =>
    asAdmin(request, () => {
      const t = mockState.world.secretTypes.find((x) => x.id === variables.id);
      if (!t) return refusal("NOT_FOUND", "type not found");
      let name = `${t.name} (copy)`;
      for (let n = 2; byName(name); n++) name = `${t.name} (copy ${n})`;
      const copy: MockType = {
        ...structuredClone(t),
        id: newToken("mock-type"),
        name,
        origin: "custom",
        vendor: undefined,
      };
      mockState.world.secretTypes.push(copy);
      return ok({ cloneSecretType: { id: copy.id, name: copy.name } });
    }),
  ),

  api.mutation(AdminImportExtensionDocument, ({ request, variables }) =>
    asAdmin(request, () => {
      const pack = catalogue.packs.find((p) => p.id === variables.id);
      if (!pack) return refusal("NOT_FOUND", "that pack isn't available");
      catalogue.packs = catalogue.packs.filter((p) => p.id !== pack.id);
      const t: MockType = { ...pack, id: newToken("mock-type") };
      mockState.world.secretTypes.push(t);
      return ok({ importExtension: { id: t.id, name: t.name } });
    }),
  ),

  api.mutation(AdminImportExtensionFromJsonDocument, ({ request, variables }) =>
    asAdmin(request, () => {
      let parsed: { fields?: Field[]; name?: string; vendor?: string };
      try {
        parsed = JSON.parse(variables.json) as typeof parsed;
      } catch {
        return refusal("INVALID_ARGUMENT", "the pack isn't valid JSON");
      }
      if (!parsed.name || !Array.isArray(parsed.fields))
        return refusal("INVALID_ARGUMENT", "a pack needs a name and a fields list");
      const input = { fields: parsed.fields, name: parsed.name };
      const problem = typeProblem(input);
      if (problem) return refusal("INVALID_ARGUMENT", problem);
      if (byName(parsed.name))
        return refusal("ALREADY_EXISTS", "a type with that name already exists");
      const t: MockType = {
        ...input,
        id: newToken("mock-type"),
        origin: "extension",
        vendor: parsed.vendor ?? "Imported",
      };
      mockState.world.secretTypes.push(t);
      return ok({ importExtensionFromJson: { id: t.id, name: t.name } });
    }),
  ),
];
