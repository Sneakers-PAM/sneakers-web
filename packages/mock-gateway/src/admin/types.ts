import {
  AdminCloneSecretTypeDocument,
  AdminCreateSecretTypeDocument,
  AdminDeleteSecretTypeDocument,
  AdminImportExtensionDocument,
  AdminImportExtensionFromJsonDocument,
  AdminSecretTypeDocument,
  AdminSecretTypesDocument,
  AdminUpdateSecretTypeDocument,
  type SecretFieldDefInput,
  type SecretTypeInput,
} from "@sneakers-web/api-client";
import { HttpResponse } from "msw";

import { isSiteAdmin, notSiteAdmin, refusal } from "#mock/admin/refuse";
import { settings } from "#mock/admin/settings";
import { api, asUser } from "#mock/handlers/graphql";
import { newToken, onMockReset } from "#mock/state";

export interface MockType {
  checkout?: boolean;
  fields: Field[];
  heartbeat?: boolean;
  id: string;
  name: string;
  origin: "custom" | "extension" | "system";
  rotation?: boolean;
  vendor?: string;
}

type Field = SecretFieldDefInput;

const user: Field = { key: "username", kind: "text", label: "Username", required: true };
const password: Field = {
  key: "password",
  kind: "password",
  label: "Password",
  policyId: "mock-policy-strong",
  required: true,
  rotates: true,
  sensitive: true,
};
const notes: Field = { key: "notes", kind: "multiline", label: "Notes" };
const host: Field = { key: "host", kind: "text", label: "Host", required: true };

const types = (): MockType[] => [
  {
    fields: [user, password, notes],
    heartbeat: true,
    id: "mock-type-password",
    name: "Password",
    origin: "system",
  },
  {
    checkout: true,
    fields: [
      host,
      { key: "port", kind: "text", label: "Port" },
      { key: "database", kind: "text", label: "Database" },
      user,
      password,
      notes,
    ],
    heartbeat: true,
    id: "mock-type-database",
    name: "Database Account",
    origin: "system",
    rotation: true,
  },
  {
    fields: [
      user,
      { key: "publicKey", kind: "multiline", label: "Public key" },
      {
        key: "privateKey",
        kind: "sensitive",
        label: "Private key",
        required: true,
        rotates: true,
        sensitive: true,
        superSensitive: true,
      },
      { key: "passphrase", kind: "sensitive", label: "Passphrase", sensitive: true },
      notes,
    ],
    heartbeat: true,
    id: "mock-type-ssh",
    name: "SSH Key",
    origin: "system",
    rotation: true,
  },
  {
    fields: [
      { key: "certificate", kind: "file", label: "Certificate", required: true },
      {
        key: "privateKey",
        kind: "sensitive",
        label: "Private key",
        sensitive: true,
        superSensitive: true,
      },
      { key: "passphrase", kind: "sensitive", label: "Passphrase", sensitive: true },
      notes,
    ],
    heartbeat: true,
    id: "mock-type-certificate",
    name: "SSL/TLS Certificate",
    origin: "system",
  },
  {
    checkout: true,
    fields: [
      { key: "domain", kind: "text", label: "Domain", required: true },
      user,
      password,
      { key: "serviceAccount", kind: "boolean", label: "Service account" },
      notes,
    ],
    heartbeat: true,
    id: "mock-type-windows",
    name: "Windows Domain Account",
    origin: "system",
    rotation: true,
  },
  {
    fields: [
      { key: "token", kind: "sensitive", label: "Token", required: true, sensitive: true },
      { key: "url", kind: "text", label: "API URL" },
      notes,
    ],
    id: "mock-type-api-token",
    name: "API Token",
    origin: "system",
  },
  {
    fields: [
      host,
      user,
      password,
      { key: "enable", kind: "password", label: "Enable secret", sensitive: true },
    ],
    heartbeat: true,
    id: "mock-type-acme-router",
    name: "Acme Router Admin",
    origin: "extension",
    rotation: true,
    vendor: "Acme",
  },
  {
    fields: [
      { key: "gateway", kind: "text", label: "Gateway", required: true },
      user,
      { key: "profile", kind: "file", label: "Profile" },
    ],
    id: "mock-type-acme-vpn",
    name: "Acme VPN Profile",
    origin: "extension",
    vendor: "Acme",
  },
  {
    fields: [
      {
        defaultValue: "North door",
        key: "location",
        kind: "select",
        label: "Location",
        options: ["North door", "South door", "Loading bay"],
        required: true,
      },
      {
        key: "code",
        kind: "password",
        label: "Code",
        policyEnforcement: "strict",
        policyId: "mock-policy-pin",
        required: true,
        sensitive: true,
      },
    ],
    id: "mock-type-door-code",
    name: "Break-room Door Code",
    origin: "custom",
  },
];

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

/** How many secrets use each type: the vault refuses to delete a type in use. */
const usage = (): Record<string, number> => ({
  "mock-type-acme-router": 2,
  "mock-type-database": 6,
  "mock-type-door-code": 3,
  "mock-type-password": 38,
  "mock-type-ssh": 4,
  "mock-type-windows": 5,
});

export const catalogue = { packs: packs(), types: types(), usage: usage() };

onMockReset(() => {
  catalogue.packs = packs();
  catalogue.types = types();
  catalogue.usage = usage();
});

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
  catalogue.types.some(
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
        secretTypes: catalogue.types.map((t) => view(t)),
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
        secretTypes: catalogue.types.map((t) => view(t)),
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
        heartbeat: !!variables.input.heartbeat,
        id: newToken("mock-type"),
        name: variables.input.name.trim(),
        origin: "custom",
        rotation: !!variables.input.rotation,
      };
      catalogue.types.push(t);
      return ok({ createSecretType: view(t) });
    }),
  ),

  api.mutation(AdminUpdateSecretTypeDocument, ({ request, variables }) =>
    asAdmin(request, () => {
      const t = catalogue.types.find((x) => x.id === variables.id);
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
      Object.assign(t, { ...variables.input, name: variables.input.name.trim() });
      return ok({ updateSecretType: view(t) });
    }),
  ),

  api.mutation(AdminDeleteSecretTypeDocument, ({ request, variables }) =>
    asAdmin(request, () => {
      const t = catalogue.types.find((x) => x.id === variables.id);
      if (!t) return refusal("NOT_FOUND", "type not found");
      if (t.origin === "system")
        return refusal("FAILED_PRECONDITION", "built-in types can't be deleted");
      const used = catalogue.usage[t.id] ?? 0;
      if (used > 0) return refusal("FAILED_PRECONDITION", `${used} secrets use this type`);
      catalogue.types = catalogue.types.filter((x) => x.id !== t.id);
      if (
        t.origin === "extension" &&
        t.vendor &&
        !catalogue.types.some((x) => x.vendor === t.vendor)
      )
        catalogue.packs.push({ ...t, id: newToken("mock-pack") });
      return ok({ deleteSecretType: true });
    }),
  ),

  api.mutation(AdminCloneSecretTypeDocument, ({ request, variables }) =>
    asAdmin(request, () => {
      const t = catalogue.types.find((x) => x.id === variables.id);
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
      catalogue.types.push(copy);
      return ok({ cloneSecretType: { id: copy.id, name: copy.name } });
    }),
  ),

  api.mutation(AdminImportExtensionDocument, ({ request, variables }) =>
    asAdmin(request, () => {
      const pack = catalogue.packs.find((p) => p.id === variables.id);
      if (!pack) return refusal("NOT_FOUND", "that pack isn't available");
      catalogue.packs = catalogue.packs.filter((p) => p.id !== pack.id);
      const t: MockType = { ...pack, id: newToken("mock-type") };
      catalogue.types.push(t);
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
      catalogue.types.push(t);
      return ok({ importExtensionFromJson: { id: t.id, name: t.name } });
    }),
  ),
];
