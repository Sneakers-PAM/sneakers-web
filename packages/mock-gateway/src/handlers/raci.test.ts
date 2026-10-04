// @vitest-environment node
import {
  folderAccess,
  folderChain,
  folderRuleset,
  hidden,
  type Outcome,
  ownsFolder,
  resolve,
  secretAccess,
  secretChain,
  secretRuleset,
  setFolderRuleset,
  setSecretRuleset,
  simulateFolder,
  simulateSecret,
} from "#mock/handlers/raci";
import { mockState } from "#mock/state";
import { withMockGateway } from "#mock/testing";

withMockGateway();

const ALICE = "mock-user-alice";
const BOB = "mock-user-bob";
const CAROL = "mock-user-carol";
const DAVE = "mock-user-dave";
const DATABASES = "mock-folder-databases";
const PLATFORM = "mock-folder-platform";
const FINANCE = "mock-folder-finance";
const DB_ADMIN = "mock-secret-db-admin";

const world = () => mockState.world;
const secret = (id: string) => {
  const s = world().secrets.find((x) => x.id === id);
  if (!s) throw new Error(`no secret ${id}`);
  return s;
};

const value = <T>(o: Outcome<T>): T => {
  if (!o.ok) throw new Error("refused");
  return o.value;
};

/** The refusal's GraphQL extensions: its code and reason. */
const refusalOf = async <T>(o: Outcome<T>): Promise<{ code?: string; reason?: string }> => {
  expect(o.ok).toBe(false);
  if (o.ok) return {};
  const body = (await (o.refusal as Response).json()) as {
    errors: { extensions: { code: string; reason?: string } }[];
  };
  return body.errors[0]?.extensions ?? {};
};

const codeOf = async <T>(o: Outcome<T>) => {
  const r = await refusalOf(o);
  return r.code;
};

const reasonOf = async <T>(o: Outcome<T>) => {
  const r = await refusalOf(o);
  return r.reason;
};

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

describe("resolve", () => {
  it("lets the nearest rule win: Dave's own deny beats his group's allow", () => {
    const r = resolve(DAVE, folderChain(DATABASES));
    expect(r.read).toEqual({ allowed: false, reason: `rule #1 deny user ${DAVE}` });
    expect(r.author.allowed).toBe(false);
    expect(r.ack).toEqual({ allowed: true, reason: "rule #2 allow group DB team" });
  });

  it("gives a group member what the group allows, and manage implies read", () => {
    const r = resolve(BOB, folderChain(DATABASES));
    expect(r.read.allowed).toBe(true);
    expect(r.author.allowed).toBe(true);
  });

  it("falls through to the folders above, naming where the answer came from", () => {
    const r = resolve(DAVE, folderChain(DATABASES, []));
    expect(r.ack.reason).toBe("↳ Platform #2 allow everyone");
    expect(r.read.reason).toBe("no rule → default deny");
  });

  it("gives owners up the chain everything but informed", () => {
    const r = resolve(CAROL, folderChain(DATABASES));
    expect(r.approve.reason).toBe("owner (auto read/approve/author)");
    expect(r.read.allowed).toBe(true);
  });

  it("lets site admins read everything, but approve only by rule or ownership", () => {
    world()
      .folders.find((f) => f.id === FINANCE)
      ?.owners.splice(0);
    const r = resolve(ALICE, folderChain(FINANCE));
    expect(r.read.reason).toBe("site-admin reads all");
    expect(r.approve.allowed).toBe(false);
  });

  it("checks a secret's own rules before its folder's", () => {
    const r = resolve(BOB, secretChain(secret(DB_ADMIN)));
    expect(r.read.allowed).toBe(true);
    expect(r.author.reason).toBe("rule #1 deny group DB team");
  });

  it("implies read from approve, and gates approve and manage on read", () => {
    const approver = resolve(DAVE, [
      {
        name: "X",
        owners: [],
        rules: [{ grants: { A: "allow" }, subjectKind: "user", subjectName: DAVE }],
      },
    ]);
    expect(approver.read).toEqual({ allowed: true, reason: "approver implies read" });
    const none = resolve(DAVE, [{ name: "X", owners: [], rules: [] }]);
    expect(none.approve.reason).toBe("requires read");
  });
});

describe("ownership and visibility", () => {
  it("owns a folder through any folder above it, or as a site admin", () => {
    expect(ownsFolder(CAROL, DATABASES)).toBe(true);
    expect(ownsFolder(ALICE, FINANCE)).toBe(true);
    expect(ownsFolder(BOB, DATABASES)).toBe(false);
  });

  it("hides someone else's personal folder", () => {
    const bobs = world().folders.find((f) => f.id === "mock-folder-bob");
    if (!bobs) throw new Error("no folder");
    expect(hidden(ALICE, bobs)).toBe(true);
    expect(hidden(BOB, bobs)).toBe(false);
  });

  it("answers access, and not-found for what the user can't know about", async () => {
    expect(value(folderAccess(BOB, DATABASES))).toMatchObject({
      manage: true,
      manageRuleset: false,
      read: true,
    });
    expect(value(secretAccess(BOB, DB_ADMIN))).toMatchObject({ manage: false, read: true });
    expect(await codeOf(folderAccess(ALICE, "mock-folder-bob"))).toBe("NOT_FOUND");
  });
});

describe("reading a ruleset", () => {
  it("returns own rules in order, and inherited rules and owners with their folder", () => {
    const rs = value(folderRuleset(ALICE, DATABASES));
    expect(rs.owners).toEqual([ALICE]);
    expect(rs.rules.map((r) => [r.order, r.subjectKind, r.subjectName, r.folderId])).toEqual([
      [0, "user", DAVE, DATABASES],
      [1, "group", "DB team", DATABASES],
    ]);
    expect(rs.rules[1]?.subjectId).toBe("mock-group-db");
    expect(rs.inherited.map((index) => [index.fromFolderName, index.rule.subjectKind])).toEqual([
      ["Platform", "group"],
      ["Platform", "everyone"],
    ]);
    expect(rs.inheritedOwners).toEqual([
      { fromFolderId: PLATFORM, fromFolderName: "Platform", userId: CAROL },
    ]);
  });

  it("shows a reader the ruleset, and refuses someone who can't read the folder", async () => {
    expect(folderRuleset(BOB, DATABASES).ok).toBe(true);
    expect(await codeOf(folderRuleset(DAVE, DATABASES))).toBe("PERMISSION_DENIED");
  });

  it("returns a secret's rules with its whole folder chain inherited", () => {
    const rs = value(secretRuleset(ALICE, DB_ADMIN));
    expect(rs.rules.map((r) => r.subjectName)).toEqual(["DB team"]);
    expect(rs.inherited.map((index) => index.fromFolderName)).toEqual([
      "Databases",
      "Databases",
      "Platform",
      "Platform",
    ]);
  });
});

describe("simulating", () => {
  it("evaluates draft rules without saving them", () => {
    const d = value(
      simulateFolder(ALICE, DATABASES, DAVE, [
        { grants: [{ action: "C", value: "allow" }], subjectKind: "user", subjectName: DAVE },
      ]),
    );
    expect(d).toMatchObject({ read: true, readReason: `rule #1 allow user ${DAVE}`, reveal: true });
    expect(world().folderRules.filter((r) => r.folderId === DATABASES)).toHaveLength(2);
  });

  it("simulates a secret against its real folder chain", () => {
    expect(value(simulateSecret(ALICE, DB_ADMIN, BOB, []))).toMatchObject({
      manage: true,
      read: true,
    });
  });

  it("is for owners only, and needs a real user", async () => {
    expect(await codeOf(simulateFolder(BOB, DATABASES, DAVE, []))).toBe("PERMISSION_DENIED");
    expect(await codeOf(simulateFolder(ALICE, DATABASES, "mock-user-x", []))).toBe("NOT_FOUND");
  });
});

describe("saving a ruleset", () => {
  it("replaces a folder's owners and rules, in order", () => {
    const rs = value(
      setFolderRuleset(
        ALICE,
        DATABASES,
        [ALICE, BOB],
        [
          {
            grants: [{ action: "A", value: "allow" }],
            subjectId: "mock-group-finance",
            subjectKind: "group",
            subjectName: "Finance",
          },
        ],
      ),
    );
    expect(rs.owners).toEqual([ALICE, BOB]);
    expect(rs.rules.map((r) => [r.subjectName, r.grants])).toEqual([
      ["Finance", [{ action: "A", value: "allow" }]],
    ]);
    expect(value(folderRuleset(ALICE, DATABASES)).rules).toHaveLength(1);
  });

  it("refuses someone who doesn't own the folder, changing nothing", async () => {
    expect(await reasonOf(setFolderRuleset(BOB, DATABASES, [BOB], []))).toBe("NOT_FOLDER_OWNER");
    expect(world().folders.find((f) => f.id === DATABASES)?.owners).toEqual([ALICE]);
  });

  it("refuses a group rule without the group's id", async () => {
    const o = setFolderRuleset(
      ALICE,
      DATABASES,
      [ALICE],
      [{ grants: [], subjectKind: "group", subjectName: "DB team" }],
    );
    expect(await refusalOf(o)).toEqual({ code: "INVALID_ARGUMENT", reason: "GROUP_ID_REQUIRED" });
  });

  it("lets only site admins change everyone rules", async () => {
    const everyone = [
      { grants: [{ action: "I", value: "allow" }], subjectKind: "everyone", subjectName: "" },
    ];
    expect(await codeOf(setFolderRuleset(BOB, FINANCE, [BOB], everyone))).toBe("PERMISSION_DENIED");
    expect(setFolderRuleset(BOB, FINANCE, [BOB], []).ok).toBe(true);
    expect(setFolderRuleset(ALICE, FINANCE, [BOB], everyone).ok).toBe(true);
  });

  it("replaces a secret's rules, gated by its folder's owners", async () => {
    expect(value(setSecretRuleset(ALICE, DB_ADMIN, [])).rules).toEqual([]);
    expect(world().secretRules.filter((r) => r.secretId === DB_ADMIN)).toEqual([]);
    expect(await reasonOf(setSecretRuleset(BOB, DB_ADMIN, []))).toBe("NOT_FOLDER_OWNER");
  });
});
