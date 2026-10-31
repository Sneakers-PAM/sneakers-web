// @vitest-environment node
import {
  auth,
  EditorsChangeSecretTypeDocument,
  EditorsPreviewTypeChangeDocument,
  GatewayClient,
  GraphQLRequestError,
  SecretVersionsDocument,
} from "@sneakers-web/api-client";

import { MOCK_GATEWAY_URL, MOCK_SESSION_COOKIE, mockState } from "#mock/state";
import { sessionCookie, withMockGateway } from "#mock/testing";

withMockGateway();

const DB = "mock-secret-db-admin";
const ROUTER = "mock-secret-edge-router";
const SSH = "type-unix-ssh";
const TOKEN = "type-api-token";

const as = async (userId: string) => {
  const gw = new GatewayClient({
    baseUrl: MOCK_GATEWAY_URL,
    cookieHeader: sessionCookie(userId),
    sessionCookie: MOCK_SESSION_COOKIE,
  });
  await auth.getSession(gw);
  return gw;
};
const alice = () => as("mock-user-alice");
const secret = (id: string) => mockState.world.secrets.find((s) => s.id === id);

const refused = async (p: Promise<unknown>) => {
  const error = await p.then(
    () => null,
    (error_: unknown) => error_,
  );
  expect(error).toBeInstanceOf(GraphQLRequestError);
  return error as GraphQLRequestError;
};

describe("the mock type change", () => {
  it("previews without writing, in keys only, and asks for what the new type requires", async () => {
    const gw = await alice();
    const before = structuredClone(secret(ROUTER));
    const { previewSecretTypeChange: preview } = await gw.gql(EditorsPreviewTypeChangeDocument, {
      id: ROUTER,
      newTypeId: SSH,
    });
    expect(preview).toMatchObject({
      allowed: false,
      missingRequiredKeys: ["host"],
      refusalReason: "FIELD_VALUE_REQUIRED",
      rotation: "none",
      target: "kept",
    });
    expect(preview.fieldChanges).toEqual([
      { fromKey: "notes", outcome: "carried", reason: null, toKey: "notes" },
      { fromKey: "password", outcome: "carried", reason: null, toKey: "password" },
      { fromKey: "username", outcome: "carried", reason: null, toKey: "username" },
    ]);
    expect(JSON.stringify(preview)).not.toContain("mock-Vamp-Collar-63");
    expect(secret(ROUTER)).toEqual(before);
  });

  it("changes Password to Password Account (SSH), keeping every value, as a new labelled version", async () => {
    const gw = await alice();
    const kept = { ...secret(ROUTER)?.fields };
    const { changeSecretType: changed } = await gw.gql(EditorsChangeSecretTypeDocument, {
      fields: [{ key: "host", value: "router.example.org" }],
      id: ROUTER,
      newTypeId: SSH,
    });
    expect(changed.secret.typeId).toBe(SSH);
    expect(changed.movedToNotesKeys).toEqual([]);
    expect(secret(ROUTER)?.typeId).toBe(SSH);
    expect(secret(ROUTER)?.fields).toEqual({ ...kept, host: "router.example.org" });
    const { secretVersions } = await gw.gql(SecretVersionsDocument, { secretId: ROUTER });
    expect(secretVersions[0]?.changeLabel).toBe(
      "Type changed: Password -> Password Account (SSH); added host; fields carried over: notes, password, username",
    );
  });

  it("moves a value with no field to notes, or refuses naming it under refuse", async () => {
    const gw = await alice();
    const mapping = [{ from: "password", to: "token" }];
    const refusal = await refused(
      gw.gql(EditorsChangeSecretTypeDocument, {
        fieldMapping: mapping,
        id: DB,
        newTypeId: TOKEN,
        unmappedFields: "refuse",
      }),
    );
    expect(refusal.reason).toBe("TYPE_CHANGE_UNMAPPED_FIELDS");
    expect(refusal.metadata.fields).toContain("username");

    const { changeSecretType: changed } = await gw.gql(EditorsChangeSecretTypeDocument, {
      fieldMapping: mapping,
      id: DB,
      newTypeId: TOKEN,
    });
    expect(changed.movedToNotesKeys).toContain("username");
    expect(changed.notesFieldKey).toBe("notes");
    expect(secret(DB)?.fields.notes).toContain('[moved from username]: "postgres_admin"');
    expect(secret(DB)?.fields.token).toBe("mock-Tongue-Eyelet-91");
  });

  it("blocks a sensitive value from a less protected field, naming it", async () => {
    const gw = await alice();
    const { previewSecretTypeChange: preview } = await gw.gql(EditorsPreviewTypeChangeDocument, {
      id: DB,
      newTypeId: TOKEN,
    });
    expect(preview.allowed).toBe(false);
    expect(preview.refusalReason).toBe("TYPE_CHANGE_LOWERS_PROTECTION");
    expect(preview.fieldChanges.find((c) => c.fromKey === "password")).toEqual({
      fromKey: "password",
      outcome: "blocked",
      reason: "TYPE_CHANGE_LOWERS_PROTECTION",
      toKey: null,
    });
    const refusal = await refused(
      gw.gql(EditorsChangeSecretTypeDocument, { id: DB, newTypeId: TOKEN }),
    );
    expect(refusal.reason).toBe("TYPE_CHANGE_LOWERS_PROTECTION");
    expect(refusal.metadata.fields).toBe("password");
  });

  it("refuses someone who can't edit it, a retired secret and the type it already has", async () => {
    const bob = await as("mock-user-bob");
    const denied = await refused(
      bob.gql(EditorsPreviewTypeChangeDocument, { id: DB, newTypeId: TOKEN }),
    );
    expect(denied.code).toBe("PERMISSION_DENIED");

    const gw = await alice();
    const same = await refused(
      gw.gql(EditorsPreviewTypeChangeDocument, { id: ROUTER, newTypeId: "type-password" }),
    );
    expect(same.code).toBe("INVALID_ARGUMENT");

    const s = secret(ROUTER);
    if (s) s.retired = true;
    const retired = await refused(
      gw.gql(EditorsPreviewTypeChangeDocument, { id: ROUTER, newTypeId: SSH }),
    );
    expect(retired.reason).toBe("RETIRED");
  });
});
