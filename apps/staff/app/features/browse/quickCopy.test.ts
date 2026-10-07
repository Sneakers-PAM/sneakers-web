import type { BrowseSecretType } from "@/features/browse/types";

import { primaryFieldsOf } from "@/features/browse/quickCopy";

const type = (fields: BrowseSecretType["fields"]): BrowseSecretType => ({
  fields,
  id: "type-x",
  name: "X",
});

describe("primaryFieldsOf", () => {
  it("picks the username and the required sensitive field", () => {
    const fields = primaryFieldsOf(
      type([
        {
          key: "username",
          kind: "text",
          label: "Username",
          required: true,
          sensitive: null,
          superSensitive: null,
        },
        {
          key: "password",
          kind: "password",
          label: "Password",
          required: true,
          sensitive: true,
          superSensitive: null,
        },
        {
          key: "notes",
          kind: "multiline",
          label: "Notes",
          required: null,
          sensitive: null,
          superSensitive: null,
        },
      ]),
    );
    expect(fields.map((f) => f.fieldKey)).toEqual(["username", "password"]);
    expect(fields.map((f) => f.label)).toEqual(["Username", "Password"]);
  });

  it("prefers the required sensitive field over an optional one, such as an SSH key's passphrase", () => {
    const fields = primaryFieldsOf(
      type([
        {
          key: "username",
          kind: "text",
          label: "Username",
          required: true,
          sensitive: null,
          superSensitive: null,
        },
        {
          key: "keyFormat",
          kind: "select",
          label: "Key Format",
          required: null,
          sensitive: null,
          superSensitive: null,
        },
        {
          key: "publicKey",
          kind: "multiline",
          label: "Public Key",
          required: null,
          sensitive: null,
          superSensitive: null,
        },
        {
          key: "privateKey",
          kind: "sensitive",
          label: "Private Key",
          required: true,
          sensitive: true,
          superSensitive: null,
        },
        {
          key: "passphrase",
          kind: "sensitive",
          label: "Passphrase",
          required: null,
          sensitive: true,
          superSensitive: null,
        },
      ]),
    );
    expect(fields.map((f) => f.fieldKey)).toEqual(["username", "privateKey"]);
  });

  it("falls back to the first sensitive field when none is marked required, such as a certificate", () => {
    const fields = primaryFieldsOf(
      type([
        {
          key: "certificate",
          kind: "multiline",
          label: "Certificate",
          required: true,
          sensitive: null,
          superSensitive: null,
        },
        {
          key: "privateKey",
          kind: "sensitive",
          label: "Private Key",
          required: null,
          sensitive: true,
          superSensitive: true,
        },
      ]),
    );
    expect(fields.map((f) => f.fieldKey)).toEqual(["privateKey"]);
    expect(fields[0]?.superSensitive).toBe(true);
  });

  it("offers only the value field when a type has no username, such as a secure note", () => {
    const fields = primaryFieldsOf(
      type([
        {
          key: "note",
          kind: "multiline",
          label: "Note",
          required: true,
          sensitive: true,
          superSensitive: null,
        },
      ]),
    );
    expect(fields.map((f) => f.fieldKey)).toEqual(["note"]);
  });

  it("offers nothing for a type with no sensitive field and no username", () => {
    const fields = primaryFieldsOf(
      type([
        {
          key: "gateway",
          kind: "text",
          label: "Gateway",
          required: true,
          sensitive: null,
          superSensitive: null,
        },
      ]),
    );
    expect(fields).toEqual([]);
  });

  it("returns nothing for an unknown type", () => {
    expect(primaryFieldsOf()).toEqual([]);
  });
});
