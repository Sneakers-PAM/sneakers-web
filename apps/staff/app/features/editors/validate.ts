import type { EditorsTypeFieldsFragment } from "@sneakers-web/api-client";

import { meetsPolicy, type Policy, policyFor } from "@/features/editors/policy";
import { keyPairMatch, parsePrivateKey, parsePublicKey } from "@/features/editors/sshKey";

export interface Draft {
  folderId: string;
  name: string;
  typeId: string;
  values: Record<string, string>;
}
export type FieldDefinition = SecretType["fields"][number];

/** One thing to fix: the line under the field, and the short form for the summary banner. */
export interface Problem {
  message: string;
  summary: string;
}

export interface Problems {
  basics: Partial<Record<"folderId" | "name" | "typeId", Problem>>;
  fields: Record<string, Problem>;
}

export type SecretType = EditorsTypeFieldsFragment;

/** A value the editor never prefills and the vault only hands out by reveal. */
export const isSensitive = (f: FieldDefinition): boolean =>
  f.kind === "password" || f.kind === "sensitive" || !!f.sensitive || !!f.superSensitive;

/** A type that holds an SSH key pair, so the editor offers generation and import. */
export const isKeyPairType = (t: SecretType): boolean =>
  t.fields.some((f) => f.key === "privateKey") && t.fields.some((f) => f.key === "publicKey");

/** Certificates come in from a file, which the vault parses, rather than typed fields. */
export const isCertificateType = (t: SecretType): boolean => t.id === "type-ssl-cert";

const problem = (message: string, summary: string): Problem => ({ message, summary });

const required = (f: FieldDefinition) =>
  f.kind === "select"
    ? problem(`Pick the ${f.label.toLowerCase()}.`, `${f.label} is required`)
    : problem(`Enter the ${f.label.toLowerCase()}.`, `${f.label} is required`);

const matches = (pattern: string, value: string) => {
  try {
    return new RegExp(pattern).test(value);
  } catch {
    return true;
  }
};

const keyProblem = (f: FieldDefinition, value: string, values: Record<string, string>) => {
  const privateKey = (values.privateKey ?? "").trim();
  if (f.key === "privateKey" && value && !parsePrivateKey(value))
    return problem("That isn't an SSH private key.", `${f.label} isn't an SSH key`);
  if (f.key === "publicKey" && value) {
    if (!parsePublicKey(value))
      return problem("That isn't an SSH public key.", `${f.label} isn't an SSH key`);
    if (privateKey && keyPairMatch(privateKey, value) === "mismatch")
      return problem("Doesn't match the private key.", "The key pair doesn't match");
  }
  if (f.key === "passphrase" && !value && privateKey && parsePrivateKey(privateKey)?.encrypted)
    return problem("This key is encrypted. Enter its passphrase.", "The key needs its passphrase");
  return null;
};

const fieldProblem = (
  f: FieldDefinition,
  values: Record<string, string>,
  policies: Policy[],
  editing: boolean,
  keyPair: boolean,
): null | Problem => {
  const value = (values[f.key] ?? "").trim();
  if (!value) {
    // On edit a blank sensitive value keeps the stored one.
    if (f.required && f.kind !== "boolean" && !(editing && isSensitive(f))) return required(f);
    return keyPair ? keyProblem(f, value, values) : null;
  }
  if (f.maxLength && value.length > f.maxLength)
    return problem(`Use at most ${f.maxLength} characters.`, `${f.label} is too long`);
  if (f.pattern && !matches(f.pattern, value))
    return problem("That isn't in the expected format.", `${f.label} isn't in the expected format`);
  if (f.kind === "password" && f.policyEnforcement === "strict") {
    const policy = policyFor(f, policies);
    if (policy && !meetsPolicy(value, policy))
      return problem(
        `Doesn't meet the ${policy.name} policy.`,
        `${f.label} doesn't meet the policy`,
      );
  }
  return keyPair ? keyProblem(f, value, values) : null;
};

/**
 * Everything wrong with a draft, by the type's own field definitions. The form shows these as
 * the person types, and the server action runs the same checks before it calls the gateway.
 */
export const formProblems = (
  d: Draft,
  type: SecretType | undefined,
  policies: Policy[],
  { editing }: { editing: boolean },
): Problems => {
  const out: Problems = { basics: {}, fields: {} };
  if (!d.name.trim()) out.basics.name = problem("Give the secret a name.", "Name is required");
  if (!d.folderId) out.basics.folderId = problem("Pick a folder.", "Folder is required");
  if (!type) {
    out.basics.typeId = problem("Pick a type.", "Type is required");
    return out;
  }
  if (isCertificateType(type)) return out;
  const keyPair = isKeyPairType(type);
  for (const f of type.fields) {
    const p = fieldProblem(f, d.values, policies, editing, keyPair);
    if (p) out.fields[f.key] = p;
  }
  return out;
};

export const problemCount = (p: Problems): number =>
  Object.keys(p.basics).length + Object.keys(p.fields).length;

export const problemSummaries = (p: Problems): string[] =>
  [...Object.values(p.basics), ...Object.values(p.fields)].map((x) => x.summary);
