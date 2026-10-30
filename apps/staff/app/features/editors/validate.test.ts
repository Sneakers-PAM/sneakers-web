import type { Policy } from "@/features/editors/policy";

import { armored } from "@/features/editors/sshKey";
import {
  type FieldDefinition,
  formProblems,
  isGitHubAppType,
  type SecretType,
} from "@/features/editors/validate";
import { appKeyPem } from "@/test/appKeys";

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

  it("refuses a select value that isn't one of its options, naming the allowed ones", () => {
    const base = { host: "h", password: "Aa1!aaaaaaaaaaaa" };
    expect(
      formProblems(draft({ ...base, engine: "postgres" }), database, [strong], { editing: true })
        .fields.engine,
    ).toEqual({
      message: "Not one of the allowed values: PostgreSQL, MySQL. Pick one.",
      summary: "Engine isn't one of the allowed values",
    });
    for (const engine of ["PostgreSQL", ""])
      expect(
        formProblems(draft({ ...base, engine }), database, [strong], { editing: true }).fields
          .engine,
      ).toBeUndefined();
  });

  describe("a GitHub App", () => {
    const app = {
      ...type([
        field({
          key: "appId",
          kind: "text",
          label: "App ID",
          pattern: String.raw`^\d+$`,
          required: true,
        }),
        field({
          key: "installationId",
          kind: "text",
          label: "Installation ID",
          pattern: String.raw`^\d+$`,
        }),
        field({
          key: "privateKey",
          kind: "multiline",
          label: "Private Key (PEM)",
          required: true,
          sensitive: true,
        }),
        field({ key: "ownerOrg", kind: "text", label: "Owner Org", required: true }),
      ]),
      id: "type-github-app",
    };
    const good = { appId: "123456", ownerOrg: "example-org", privateKey: appKeyPem() };
    const check = (values: Record<string, string>, editing = false) =>
      formProblems(draft(values, { typeId: app.id }), app, [], { editing }).fields;

    it("is the type the editor gives its own card", () => {
      expect(isGitHubAppType(app)).toBe(true);
      expect(isGitHubAppType(database)).toBe(false);
    });

    it("takes the .pem GitHub downloads, with digits for the ids", () => {
      expect(check({ ...good, installationId: "98765432" })).toEqual({});
    });

    it("says the ids take digits only", () => {
      const p = check({ ...good, appId: "my-app", installationId: "12 34" });
      expect(p.appId?.message).toBe("Use digits only.");
      expect(p.installationId?.message).toBe("Use digits only.");
    });

    it("refuses a file that isn't the App's private key, saying what it is", () => {
      expect(
        check({ ...good, privateKey: armored("OPENSSH PRIVATE KEY", "TW9jaw==") }).privateKey,
      ).toEqual({
        message: "That's an SSH key. Use the .pem file GitHub downloaded for the App.",
        summary: "Private Key (PEM) isn't a GitHub App key",
      });
    });

    it("keeps the stored key on edit when none is given", () => {
      expect(check({ ...good, privateKey: "" }, true)).toEqual({});
      expect(check({ ...good, privateKey: "" }).privateKey?.message).toBe(
        "Enter the private key (pem).",
      );
    });
  });
});
