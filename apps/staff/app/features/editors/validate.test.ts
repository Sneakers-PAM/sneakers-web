import type { Policy } from "@/features/editors/policy";

import { armored } from "@/features/editors/sshKey";
import { type FieldDefinition, formProblems, type SecretType } from "@/features/editors/validate";

const field = (
  f: Partial<FieldDefinition> & Pick<FieldDefinition, "key" | "kind" | "label">,
): FieldDefinition => ({
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

const type = (fields: FieldDefinition[]): SecretType => ({
  checkout: null,
  fields,
  heartbeat: null,
  id: "type-test",
  name: "Test",
  origin: "custom",
  rotation: null,
  vendor: null,
});

const strong: Policy = {
  endLiteral: null,
  excludeChars: null,
  id: "mock-policy-strong",
  isDefault: true,
  maxLength: 64,
  minLength: 14,
  name: "Strong",
  requireDigit: true,
  requireLower: true,
  requireSymbol: true,
  requireUpper: true,
  startClass: null,
};

const database = type([
  field({ key: "host", kind: "text", label: "Host", required: true }),
  field({ key: "port", kind: "text", label: "Port", maxLength: 5, pattern: "^[0-9]+$" }),
  field({ key: "engine", kind: "select", label: "Engine", options: ["PostgreSQL", "MySQL"] }),
  field({
    key: "password",
    kind: "password",
    label: "Password",
    policyEnforcement: "strict",
    required: true,
    sensitive: true,
  }),
]);

const draft = (values: Record<string, string>, basics = {}) => ({
  folderId: "mock-folder-databases",
  name: "Reporting writer",
  typeId: database.id,
  values,
  ...basics,
});

describe("checking a secret against its type", () => {
  it("passes a complete secret", () => {
    const p = formProblems(
      draft({
        engine: "MySQL",
        host: "db1.example.org",
        password: "Aa1!aaaaaaaaaaaa",
        port: "5432",
      }),
      database,
      [strong],
      { editing: false },
    );
    expect(p).toEqual({ basics: {}, fields: {} });
  });

  it("names missing basics and required fields", () => {
    const p = formProblems(
      draft({ password: "Aa1!aaaaaaaaaaaa" }, { folderId: "", name: " " }),
      database,
      [strong],
      { editing: false },
    );
    expect(Object.keys(p.basics)).toEqual(["name", "folderId"]);
    expect(p.fields.host).toEqual({ message: "Enter the host.", summary: "Host is required" });
  });

  it("follows the pattern and max length of each field", () => {
    const p = formProblems(
      draft({ engine: "Oracle", host: "h", password: "Aa1!aaaaaaaaaaaa", port: "54x" }),
      database,
      [strong],
      { editing: false },
    );
    expect(p.fields.port?.summary).toBe("Port isn't in the expected format");
    expect(
      formProblems(
        draft({ host: "h", password: "Aa1!aaaaaaaaaaaa", port: "123456" }),
        database,
        [strong],
        { editing: false },
      ).fields.port?.message,
    ).toBe("Use at most 5 characters.");
  });

  it("holds a strict password to its policy, and lets a lax one through", () => {
    const strict = formProblems(
      draft({ host: "h", password: "hunter2hunter2" }),
      database,
      [strong],
      { editing: false },
    );
    expect(strict.fields.password).toEqual({
      message: "Doesn't meet the Strong policy.",
      summary: "Password doesn't meet the policy",
    });
    const laxType = type(
      database.fields.map((f) =>
        f.key === "password" ? { ...f, policyEnforcement: "lax" as const } : f,
      ),
    );
    expect(
      formProblems(draft({ host: "h", password: "hunter2" }), laxType, [strong], { editing: false })
        .fields.password,
    ).toBeUndefined();
  });

  it("keeps a blank sensitive value on edit", () => {
    expect(
      formProblems(draft({ host: "h", password: "" }), database, [strong], { editing: true })
        .fields,
    ).toEqual({});
    expect(
      formProblems(draft({ host: "h", password: "" }), database, [strong], { editing: false })
        .fields.password?.summary,
    ).toBe("Password is required");
  });

  it("checks an SSH key pair: a real private key, a matching public key, and a passphrase for an encrypted key", () => {
    const ssh = type([
      field({ key: "publicKey", kind: "multiline", label: "Public Key" }),
      field({
        key: "privateKey",
        kind: "sensitive",
        label: "Private Key",
        required: true,
        sensitive: true,
      }),
      field({ key: "passphrase", kind: "sensitive", label: "Passphrase", sensitive: true }),
    ]);
    const p = formProblems(
      draft({ privateKey: "hunter2", publicKey: "nope" }, { typeId: ssh.id }),
      ssh,
      [],
      { editing: false },
    );
    expect(p.fields.privateKey?.message).toBe("That isn't an SSH private key.");
    expect(p.fields.publicKey?.message).toBe("That isn't an SSH public key.");
    const encrypted = armored("ENCRYPTED PRIVATE KEY", "TW9jaw==");
    expect(
      formProblems(draft({ privateKey: encrypted }, { typeId: ssh.id }), ssh, [], {
        editing: false,
      }).fields.passphrase?.message,
    ).toBe("This key is encrypted. Enter its passphrase.");
  });
});
