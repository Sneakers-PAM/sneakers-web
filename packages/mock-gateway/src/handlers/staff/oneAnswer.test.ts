// @vitest-environment node
import {
  auth,
  BrowseFolderAccessDocument,
  BrowseSecretsDocument,
  GatewayClient,
  SecretAccessDocument,
  SecretDetailDocument,
  SharingFolderAccessDocument,
} from "@sneakers-web/api-client";

import { folderChain, resolve, secretChain } from "#mock/handlers/raci";
import { MOCK_GATEWAY_URL, MOCK_SESSION_COOKIE, mockState } from "#mock/state";
import { sessionCookie, withMockGateway } from "#mock/testing";

withMockGateway();

const as = async (userId: string) => {
  const gw = new GatewayClient({
    baseUrl: MOCK_GATEWAY_URL,
    cookieHeader: sessionCookie(userId),
    sessionCookie: MOCK_SESSION_COOKIE,
  });
  await auth.getSession(gw);
  return gw;
};

const secret = (id: string) => {
  const s = mockState.world.secrets.find((x) => x.id === id);
  if (!s) throw new Error(`no fixture secret ${id}`);
  return s;
};

/** Every screen's answer to "can this person read it?", asked through that screen's own query. */
const answers = async (userId: string, folderId: string, secretId: string) => {
  const gw = await as(userId);
  const sharing = await gw.gql(SharingFolderAccessDocument, { folderId });
  const browse = await gw.gql(BrowseFolderAccessDocument, { folderId, ownerIds: [] });
  const listed = await gw
    .gql(BrowseSecretsDocument, { folderId })
    .then((d) => d.secretsInFolder.find((s) => s.id === secretId)?.canRead ?? false)
    .catch(() => false);
  const detail = await gw.gql(SecretDetailDocument, { id: secretId });
  const access = await gw.gql(SecretAccessDocument, { secretId });
  return {
    folder: { browse: browse.myFolderAccess.read, sharing: sharing.myFolderAccess.read },
    secret: {
      access: access.mySecretAccess.read,
      detail: detail.secret?.canRead === true,
      listed,
    },
  };
};

const expected = (userId: string, folderId: string, secretId: string) => {
  const folder = resolve(userId, folderChain(folderId)).read.allowed;
  const read = resolve(userId, secretChain(secret(secretId))).read.allowed;
  return {
    folder: { browse: folder, sharing: folder },
    secret: { access: read, detail: read, listed: read },
  };
};

describe("one RACI answer on every screen", () => {
  it("lets Bob, in the DB team, read Databases and DB admin wherever he looks", async () => {
    const got = await answers("mock-user-bob", "mock-folder-databases", "mock-secret-db-admin");
    expect(got).toEqual(expected("mock-user-bob", "mock-folder-databases", "mock-secret-db-admin"));
    expect(got.folder.browse).toBe(true);
    expect(got.secret.detail).toBe(true);
  });

  it("keeps Dave out of Databases and DB admin wherever he looks, by his own deny rule", async () => {
    const got = await answers("mock-user-dave", "mock-folder-databases", "mock-secret-db-admin");
    expect(got).toEqual(
      expected("mock-user-dave", "mock-folder-databases", "mock-secret-db-admin"),
    );
    expect(got.folder.browse).toBe(false);
    expect(got.secret.detail).toBe(false);
  });

  it("lets a site admin read a folder with no rule for her, as the vault does", async () => {
    const got = await answers("mock-user-alice", "mock-folder-helpdesk", "mock-secret-helpdesk");
    expect(got.folder.browse).toBe(true);
    expect(got.secret).toEqual({ access: true, detail: true, listed: true });
  });
});
