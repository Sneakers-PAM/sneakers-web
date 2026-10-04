// @vitest-environment node
import {
  auth,
  GatewayClient,
  GraphQLRequestError,
  SharingFolderAccessDocument,
  SharingFolderRulesetDocument,
  SharingFoldersDocument,
  SharingSearchUsersDocument,
  SharingSecretAccessDocument,
  SharingSecretDocument,
  SharingSecretRulesetDocument,
  SharingSetFolderRulesetDocument,
  SharingSetSecretRulesetDocument,
  SharingSimulateFolderDocument,
  SharingSimulateSecretDocument,
  SharingUserLabelsDocument,
} from "@sneakers-web/api-client";

import { MOCK_GATEWAY_URL, MOCK_SESSION_COOKIE, mockState } from "#mock/state";
import { sessionCookie, withMockGateway } from "#mock/testing";

withMockGateway();

const ALICE = "mock-user-alice";
const BOB = "mock-user-bob";
const CAROL = "mock-user-carol";
const DAVE = "mock-user-dave";
const DATABASES = "mock-folder-databases";
const PLATFORM = "mock-folder-platform";
const DB_ADMIN = "mock-secret-db-admin";

const as = async (userId: string) => {
  const gw = new GatewayClient({
    baseUrl: MOCK_GATEWAY_URL,
    cookieHeader: sessionCookie(userId),
    sessionCookie: MOCK_SESSION_COOKIE,
  });
  await auth.getSession(gw);
  return gw;
};

const refused = async (p: Promise<unknown>) => {
  const error = await p.then(
    () => null,
    (error_: unknown) => error_,
  );
  expect(error).toBeInstanceOf(GraphQLRequestError);
  return error as GraphQLRequestError;
};

const world = () => mockState.world;

describe("the mock world's RACI rules", () => {
  it("are invented and point at folders, secrets, groups and users that exist", () => {
    const folders = new Set(world().folders.map((f) => f.id));
    const secrets = new Set(world().secrets.map((s) => s.id));
    const groups = new Set(world().groups.map((g) => g.id));
    for (const r of [...world().folderRules, ...world().secretRules]) {
      expect(r.id).toMatch(/^mock-/);
      if (r.subjectKind === "group") expect(groups).toContain(r.subjectId);
      if (r.subjectKind === "user") expect(r.subjectName).toMatch(/^mock-user-/);
    }
    for (const r of world().folderRules) expect(folders).toContain(r.folderId);
    for (const r of world().secretRules) expect(secrets).toContain(r.secretId);
  });
});

describe("resolving access the way the vault does", () => {
  it("lets the nearest rule win: Dave's own deny beats his group's allow", async () => {
    const gw = await as(DAVE);
    const { myFolderAccess } = await gw.gql(SharingFolderAccessDocument, { folderId: DATABASES });
    expect(myFolderAccess).toEqual({
      approve: false,
      informed: true,
      manage: false,
      manageRuleset: false,
      read: false,
      reveal: false,
    });
  });

  it("gives a group member what the group's rule allows, and manage implies read", async () => {
    const gw = await as(BOB);
    const { myFolderAccess } = await gw.gql(SharingFolderAccessDocument, { folderId: DATABASES });
    expect(myFolderAccess).toMatchObject({
      manage: true,
      manageRuleset: false,
      read: true,
      reveal: true,
    });
  });

  it("gives owners up the chain everything but informed, and site admins every ruleset", async () => {
    const gw = await as(CAROL);
    const { myFolderAccess } = await gw.gql(SharingFolderAccessDocument, { folderId: DATABASES });
    expect(myFolderAccess).toMatchObject({
      approve: true,
      manage: true,
      manageRuleset: true,
      read: true,
    });
  });

  it("lets a secret's own rule come before its folder's", async () => {
    const gw = await as(BOB);
    const { mySecretAccess } = await gw.gql(SharingSecretAccessDocument, { secretId: DB_ADMIN });
    expect(mySecretAccess).toMatchObject({ manage: false, read: true });
  });

  it("hides someone else's personal folder entirely", async () => {
    const gw = await as(ALICE);
    const error = await refused(
      gw.gql(SharingFolderAccessDocument, { folderId: "mock-folder-bob" }),
    );
    expect(error.code).toBe("NOT_FOUND");
    const { folders } = await gw.gql(SharingFoldersDocument);
    expect(folders.map((f) => f.id)).not.toContain("mock-folder-bob");
  });
});

describe("reading a ruleset", () => {
  it("returns own rules in order, inherited rules and owners tagged with their folder", async () => {
    const gw = await as(ALICE);
    const { folderRuleset, groups } = await gw.gql(SharingFolderRulesetDocument, {
      folderId: DATABASES,
    });
    expect(folderRuleset.owners).toEqual([ALICE]);
    expect(folderRuleset.rules.map((r) => [r.order, r.subjectKind, r.subjectName])).toEqual([
      [0, "user", DAVE],
      [1, "group", "DB team"],
    ]);
    expect(folderRuleset.rules[1]?.subjectId).toBe("mock-group-db");
    expect(
      folderRuleset.inherited.map((index) => [index.fromFolderName, index.rule.subjectKind]),
    ).toEqual([
      ["Platform", "group"],
      ["Platform", "everyone"],
    ]);
    expect(folderRuleset.inheritedOwners).toEqual([
      { fromFolderId: PLATFORM, fromFolderName: "Platform", userId: CAROL },
    ]);
    expect(groups.map((g) => g.id)).toContain("mock-group-finance");
  });

  it("shows a reader the ruleset, but refuses someone who can't read the folder", async () => {
    const bob = await as(BOB);
    await bob.gql(SharingFolderRulesetDocument, { folderId: DATABASES });
    const dave = await as(DAVE);
    const error = await refused(dave.gql(SharingFolderRulesetDocument, { folderId: DATABASES }));
    expect(error.code).toBe("PERMISSION_DENIED");
  });

  it("returns a secret's rules with its whole folder chain inherited", async () => {
    const gw = await as(ALICE);
    const { secret } = await gw.gql(SharingSecretDocument, { secretId: DB_ADMIN });
    expect(secret?.folderId).toBe(DATABASES);
    const { secretRuleset } = await gw.gql(SharingSecretRulesetDocument, { secretId: DB_ADMIN });
    expect(secretRuleset.rules.map((r) => r.subjectName)).toEqual(["DB team"]);
    expect(secretRuleset.inherited.map((index) => index.fromFolderName)).toEqual([
      "Databases",
      "Databases",
      "Platform",
      "Platform",
    ]);
  });
});

describe("the simulator", () => {
  it("evaluates draft rules without saving them, with the vault's reasons", async () => {
    const gw = await as(ALICE);
    const before = await gw.gql(SharingSimulateFolderDocument, {
      draftRules: [],
      folderId: DATABASES,
      userId: DAVE,
    });
    expect(before.simulateFolder).toMatchObject({
      informed: true,
      informedReason: "↳ Platform #2 allow everyone",
      read: false,
      readReason: "no rule → default deny",
    });
    const draft = await gw.gql(SharingSimulateFolderDocument, {
      draftRules: [
        { grants: [{ action: "C", value: "allow" }], subjectKind: "user", subjectName: DAVE },
      ],
      folderId: DATABASES,
      userId: DAVE,
    });
    expect(draft.simulateFolder).toMatchObject({
      read: true,
      readReason: `rule #1 allow user ${DAVE}`,
      reveal: true,
    });
    expect(world().folderRules.filter((r) => r.folderId === DATABASES)).toHaveLength(2);
  });

  it("says why an owner gets access", async () => {
    const gw = await as(ALICE);
    const { simulateFolder } = await gw.gql(SharingSimulateFolderDocument, {
      draftRules: [],
      folderId: DATABASES,
      userId: CAROL,
    });
    expect(simulateFolder.approveReason).toBe("owner (auto read/approve/author)");
  });

  it("simulates a secret against its real folder chain", async () => {
    const gw = await as(ALICE);
    const { simulateSecret } = await gw.gql(SharingSimulateSecretDocument, {
      draftRules: [],
      secretId: DB_ADMIN,
      userId: BOB,
    });
    expect(simulateSecret).toMatchObject({ manage: true, read: true });
  });

  it("is for owners only", async () => {
    const gw = await as(BOB);
    const error = await refused(
      gw.gql(SharingSimulateFolderDocument, {
        draftRules: [],
        folderId: DATABASES,
        userId: DAVE,
      }),
    );
    expect(error.code).toBe("PERMISSION_DENIED");
  });
});

describe("saving a ruleset", () => {
  it("replaces a folder's owners and rules, in order", async () => {
    const gw = await as(ALICE);
    await gw.gql(SharingSetFolderRulesetDocument, {
      folderId: DATABASES,
      owners: [ALICE, BOB],
      rules: [
        {
          grants: [{ action: "A", value: "allow" }],
          subjectId: "mock-group-finance",
          subjectKind: "group",
          subjectName: "Finance",
        },
      ],
    });
    const { folderRuleset } = await gw.gql(SharingFolderRulesetDocument, { folderId: DATABASES });
    expect(folderRuleset.owners).toEqual([ALICE, BOB]);
    expect(folderRuleset.rules.map((r) => r.subjectName)).toEqual(["Finance"]);
    expect(folderRuleset.rules[0]?.grants).toEqual([{ action: "A", value: "allow" }]);
  });

  it("refuses someone who doesn't own the folder", async () => {
    const gw = await as(BOB);
    const error = await refused(
      gw.gql(SharingSetFolderRulesetDocument, {
        folderId: DATABASES,
        owners: [BOB],
        rules: [],
      }),
    );
    expect(error.reason).toBe("NOT_FOLDER_OWNER");
    expect(world().folders.find((f) => f.id === DATABASES)?.owners).toEqual([ALICE]);
  });

  it("refuses a group rule without the group's id", async () => {
    const gw = await as(ALICE);
    const error = await refused(
      gw.gql(SharingSetFolderRulesetDocument, {
        folderId: DATABASES,
        owners: [ALICE],
        rules: [{ grants: [], subjectKind: "group", subjectName: "DB team" }],
      }),
    );
    expect(error.reason).toBe("GROUP_ID_REQUIRED");
  });

  it("lets only site admins change everyone rules", async () => {
    const gw = await as(BOB);
    const error = await refused(
      gw.gql(SharingSetFolderRulesetDocument, {
        folderId: "mock-folder-finance",
        owners: [BOB],
        rules: [
          { grants: [{ action: "I", value: "allow" }], subjectKind: "everyone", subjectName: "" },
        ],
      }),
    );
    expect(error.code).toBe("PERMISSION_DENIED");
    await gw.gql(SharingSetFolderRulesetDocument, {
      folderId: "mock-folder-finance",
      owners: [BOB],
      rules: [],
    });
    expect(world().folderRules.filter((r) => r.folderId === "mock-folder-finance")).toEqual([]);
  });

  it("replaces a secret's rules, gated by its folder's owners", async () => {
    const alice = await as(ALICE);
    await alice.gql(SharingSetSecretRulesetDocument, { rules: [], secretId: DB_ADMIN });
    expect(world().secretRules.filter((r) => r.secretId === DB_ADMIN)).toEqual([]);
    const bob = await as(BOB);
    const error = await refused(
      bob.gql(SharingSetSecretRulesetDocument, { rules: [], secretId: DB_ADMIN }),
    );
    expect(error.reason).toBe("NOT_FOLDER_OWNER");
  });
});

describe("people", () => {
  it("searches people who can sign in, and names ids", async () => {
    const gw = await as(ALICE);
    const { searchUsers } = await gw.gql(SharingSearchUsersDocument, { query: "da" });
    expect(searchUsers.map((u) => u.id)).toEqual([DAVE]);
    const { searchUsers: none } = await gw.gql(SharingSearchUsersDocument, { query: "erin" });
    expect(none).toEqual([]);
    const { resolveUserLabels } = await gw.gql(SharingUserLabelsDocument, { ids: [BOB, "nobody"] });
    expect(resolveUserLabels).toEqual([{ id: BOB, name: "Bob" }]);
  });
});
