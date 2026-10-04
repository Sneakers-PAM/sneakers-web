// @vitest-environment node
import {
  auth,
  EditorsCreateSecretDocument,
  EditorsGenerateKeyPairDocument,
  EditorsImportCertificateDocument,
  EditorsPickersDocument,
  EditorsSaveTargetDocument,
  EditorsSecretDocument,
  EditorsSecretFieldsDocument,
  EditorsUpdateSecretDocument,
  GatewayClient,
  GraphQLRequestError,
} from "@sneakers-web/api-client";

import { MOCK_GATEWAY_URL, MOCK_SESSION_COOKIE, mockState } from "#mock/state";
import { sessionCookie, withMockGateway } from "#mock/testing";

withMockGateway();

const ALICE = "mock-user-alice";
const BOB = "mock-user-bob";
const DB = "mock-secret-db-admin";

const as = async (userId: string) => {
  const gw = new GatewayClient({
    baseUrl: MOCK_GATEWAY_URL,
    cookieHeader: sessionCookie(userId),
    sessionCookie: MOCK_SESSION_COOKIE,
  });
  await auth.getSession(gw);
  return gw;
};

const refusal = async (p: Promise<unknown>) => {
  const error = await p.then(
    () => null,
    (error_: unknown) => error_,
  );
  expect(error).toBeInstanceOf(GraphQLRequestError);
  const refused = error as GraphQLRequestError;
  return { code: refused.code, reason: refused.reason };
};

const secret = (id: string) => mockState.world.secrets.find((s) => s.id === id);
const b64 = (text: string) => Buffer.from(text).toString("base64");

describe("the editors' mock answers", () => {
  it("lists every type, the policies, the folders someone may see with whether they manage them, and their targets", async () => {
    const gw = await as(ALICE);
    const d = await gw.gql(EditorsPickersDocument, {});
    const ids = d.secretTypes.map((t) => t.id);
    expect(ids).toEqual(
      expect.arrayContaining(["type-acme-router", "type-acme-vpn", "type-door-code"]),
    );
    expect(d.secretTypes.find((t) => t.id === "type-acme-vpn")).toMatchObject({
      origin: "extension",
      vendor: "Acme",
    });
    expect(d.passwordPolicies.find((p) => p.isDefault)?.name).toBe("Strong");
    expect(d.folders.find((f) => f.id === "mock-folder-finance")?.canManage).toBe(true);
    const asBob = await as(BOB);
    const bob = await asBob.gql(EditorsPickersDocument, {});
    const folders = Object.fromEntries(bob.folders.map((f) => [f.id, f.canManage]));
    expect(folders["mock-folder-finance"]).toBe(true);
    expect(folders["mock-folder-databases"]).toBe(false);
    expect(folders["mock-folder-alice"]).toBeUndefined();
    expect(d.targets.length).toBeGreaterThan(0);
    expect(d.connections.length).toBeGreaterThan(0);
  });

  it("creates a secret with a first version in a folder the user manages", async () => {
    const gw = await as(ALICE);
    const r = await gw.gql(EditorsCreateSecretDocument, {
      input: {
        fields: [
          { key: "username", value: "report_writer" },
          { key: "password", value: "mock-Created-Value-1!" },
        ],
        folderId: "mock-folder-databases",
        name: "Reporting writer",
        typeId: "type-password",
      },
    });
    expect(JSON.stringify(r)).not.toContain("mock-Created-Value");
    const s = secret(r.createSecret.id);
    expect(s).toMatchObject({ folderId: "mock-folder-databases", name: "Reporting writer" });
    expect(s?.fields.password).toBe("mock-Created-Value-1!");
    expect(s?.versions).toHaveLength(1);
    expect(s?.versions[0]).toMatchObject({ active: true, createdBy: ALICE, versionNo: 1 });
  });

  it("refuses a new secret in a folder the user can't manage, or an unknown type", async () => {
    const gw = await as(BOB);
    const input = {
      fields: [],
      folderId: "mock-folder-databases",
      name: "x",
      typeId: "type-password",
    };
    expect(await refusal(gw.gql(EditorsCreateSecretDocument, { input }))).toMatchObject({
      code: "PERMISSION_DENIED",
    });
    expect(
      await refusal(
        gw.gql(EditorsCreateSecretDocument, { input: { ...input, folderId: "mock-folder-alice" } }),
      ),
    ).toMatchObject({ code: "NOT_FOUND" });
    expect(
      await refusal(
        gw.gql(EditorsCreateSecretDocument, {
          input: { ...input, folderId: "mock-folder-finance", typeId: "type-gone" },
        }),
      ),
    ).toMatchObject({ code: "NOT_FOUND" });
  });

  it("gives the edit form the secret and its non-sensitive values only", async () => {
    const gw = await as(ALICE);
    const d = await gw.gql(EditorsSecretDocument, { id: DB, secretId: DB });
    expect(d.secret?.name).toBe("DB admin");
    const f = await gw.gql(EditorsSecretFieldsDocument, { id: DB });
    expect(f.secretFields.find((x) => x.key === "username")?.value).toBe("postgres_admin");
    expect(JSON.stringify(f)).not.toContain("mock-Tongue-Eyelet");
  });

  it("adds a version naming the changed fields on edit, and keeps an omitted sensitive value", async () => {
    const gw = await as(ALICE);
    await gw.gql(EditorsUpdateSecretDocument, {
      id: DB,
      input: {
        fields: [
          { key: "username", value: "postgres_owner" },
          { key: "port", value: "5432" },
        ],
        name: "DB owner",
      },
    });
    const s = secret(DB);
    expect(s?.name).toBe("DB owner");
    expect(s?.fields.password).toBe("mock-Tongue-Eyelet-91");
    expect(s?.versions[0]).toMatchObject({
      active: true,
      changedFieldKeys: ["username"],
      versionNo: 4,
    });
    expect(s?.versions.filter((v) => v.active)).toHaveLength(1);
  });

  it("adds no version when no value changed", async () => {
    const gw = await as(ALICE);
    await gw.gql(EditorsUpdateSecretDocument, {
      id: DB,
      input: { fields: [{ key: "port", value: "5432" }], name: "DB admin" },
    });
    expect(secret(DB)?.versions).toHaveLength(3);
  });

  it("refuses an edit from someone who can't manage the secret", async () => {
    const bob = await as(BOB);
    expect(
      await refusal(bob.gql(EditorsUpdateSecretDocument, { id: DB, input: { name: "x" } })),
    ).toMatchObject({
      code: "PERMISSION_DENIED",
    });
  });

  it("generates a key pair whose halves match, for the vault's formats", async () => {
    const gw = await as(ALICE);
    const { generateKeyPair } = await gw.gql(EditorsGenerateKeyPairDocument, { format: "Ed25519" });
    expect(generateKeyPair.publicKey).toMatch(/^ssh-ed25519 \S+/);
    expect(generateKeyPair.privateKey).toContain("BEGIN OPENSSH PRIVATE KEY");
    const blob = generateKeyPair.publicKey.split(" ", 2)[1] ?? "";
    const body = generateKeyPair.privateKey.split("\n").slice(1, -1).join("");
    expect(Buffer.from(body, "base64").includes(Buffer.from(blob, "base64"))).toBe(true);
    expect(await refusal(gw.gql(EditorsGenerateKeyPairDocument, { format: "dsa" }))).toMatchObject({
      code: "INVALID_ARGUMENT",
    });
  });

  it("refuses a key pair whose halves don't match", async () => {
    const gw = await as(ALICE);
    const { generateKeyPair: a } = await gw.gql(EditorsGenerateKeyPairDocument, {
      format: "Ed25519",
    });
    const { generateKeyPair: b } = await gw.gql(EditorsGenerateKeyPairDocument, {
      format: "Ed25519",
    });
    const input = {
      fields: [
        { key: "username", value: "deploy" },
        { key: "privateKey", value: a.privateKey },
        { key: "publicKey", value: b.publicKey },
      ],
      folderId: "mock-folder-platform",
      name: "key",
      typeId: "type-ssh-key",
    };
    expect(await refusal(gw.gql(EditorsCreateSecretDocument, { input }))).toMatchObject({
      code: "INVALID_ARGUMENT",
    });
  });

  it("imports a certificate file as a new secret, or lists a bundle's entries", async () => {
    const gw = await as(ALICE);
    const one = await gw.gql(EditorsImportCertificateDocument, {
      fileBase64: b64("-----BEGIN CERTIFICATE-----\nmock\n-----END CERTIFICATE-----"),
      folderId: "mock-folder-certificates",
      name: "api.example.org",
    });
    const s = secret(one.importCertificate.secret?.id ?? "");
    expect(s).toMatchObject({
      folderId: "mock-folder-certificates",
      name: "api.example.org",
      typeId: "type-ssl-cert",
    });
    expect(s?.versions).toHaveLength(1);

    const bundle = await gw.gql(EditorsImportCertificateDocument, {
      fileBase64: b64("mock-bundle: web, api"),
      folderId: "mock-folder-certificates",
      name: "bundle",
    });
    expect(bundle.importCertificate).toEqual({ aliases: ["web", "api"], secret: null });
    expect(
      await refusal(
        gw.gql(EditorsImportCertificateDocument, {
          fileBase64: "",
          folderId: "mock-folder-certificates",
          name: "x",
        }),
      ),
    ).toMatchObject({ code: "INVALID_ARGUMENT" });
  });

  it("makes a personal target for the user", async () => {
    const gw = await as(BOB);
    const r = await gw.gql(EditorsSaveTargetDocument, {
      input: {
        connectionId: "mock-conn-postgres",
        hostname: "reports.example.org",
        name: "reports-db",
      },
    });
    expect(r.saveTarget).toMatchObject({ hostname: "reports.example.org", ownerUserId: BOB });
    expect(
      await refusal(
        gw.gql(EditorsSaveTargetDocument, {
          input: { connectionId: "mock-conn-x", hostname: "h", name: "n" },
        }),
      ),
    ).toMatchObject({ code: "INVALID_ARGUMENT" });
  });
});
