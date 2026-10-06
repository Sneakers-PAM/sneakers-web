import type { BrowseSecretType } from "@/features/browse/types";

export interface PrimaryField {
  fieldKey: string;
  label: string;
  /** A plain field (the identity field) copies its already-loaded value, no reveal needed. */
  sensitive: boolean;
  superSensitive: boolean;
}

/**
 * The fields a row's quick copy offers: the identity field, if the type has one, and the
 * type's main secret value (the required sensitive field, or the first sensitive field when
 * none is required), in that order. The value field goes through the same audited reveal the
 * secret page uses, so a super-sensitive value keeps its step-up rule; the identity field is
 * never sensitive, so it copies like the secret page's plain fields do.
 */
export const primaryFieldsOf = (type?: BrowseSecretType): PrimaryField[] => {
  if (!type) return [];
  const identity = type.fields.find((f) => f.key === "username");
  const value =
    type.fields.find((f) => f.required && f.sensitive) ?? type.fields.find((f) => f.sensitive);
  return [identity, value]
    .filter((f): f is BrowseSecretType["fields"][number] => !!f)
    .map((f) => ({
      fieldKey: f.key,
      label: f.label,
      sensitive: !!f.sensitive,
      superSensitive: !!f.superSensitive,
    }));
};
