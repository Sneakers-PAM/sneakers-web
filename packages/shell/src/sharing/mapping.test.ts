import { fromRaciRule, toRaciRuleInput } from "#shell/sharing/mapping";

describe("fromRaciRule", () => {
  it("reads a user rule's subject from subjectName, naming it from the labels", () => {
    const rule = fromRaciRule(
      {
        grants: [{ action: "C", value: "deny" }],
        subjectId: null,
        subjectKind: "user",
        subjectName: "mock-user-dave",
      },
      { "mock-user-dave": "Dave" },
    );
    expect(rule).toEqual({
      grants: { C: "deny" },
      subject: { id: "mock-user-dave", kind: "user", name: "Dave" },
    });
  });

  it("falls back to the id when no label is known", () => {
    const rule = fromRaciRule({ grants: [], subjectKind: "user", subjectName: "mock-user-x" });
    expect(rule.subject.name).toBe("mock-user-x");
  });

  it("keeps a group rule's directory id and display name", () => {
    const rule = fromRaciRule({
      grants: [
        { action: "C", value: "allow" },
        { action: "R", value: "allow" },
      ],
      subjectId: "mock-group-db",
      subjectKind: "group",
      subjectName: "DB team",
    });
    expect(rule).toEqual({
      grants: { C: "allow", R: "allow" },
      subject: { id: "mock-group-db", kind: "group", name: "DB team" },
    });
  });

  it("reads everyone without an id, and drops cells it doesn't know", () => {
    const rule = fromRaciRule({
      grants: [
        { action: "I", value: "allow" },
        { action: "X", value: "allow" },
        { action: "C", value: "maybe" },
      ],
      subjectKind: "everyone",
      subjectName: "",
    });
    expect(rule).toEqual({
      grants: { I: "allow" },
      subject: { kind: "everyone", name: "Everyone" },
    });
  });
});

describe("toRaciRuleInput", () => {
  it("writes a user rule with the user id as subjectName", () => {
    expect(
      toRaciRuleInput({
        grants: { A: "allow", C: "deny" },
        subject: { id: "mock-user-dave", kind: "user", name: "Dave" },
      }),
    ).toEqual({
      grants: [
        { action: "C", value: "deny" },
        { action: "A", value: "allow" },
      ],
      subjectKind: "user",
      subjectName: "mock-user-dave",
    });
  });

  it("writes a group rule with its id and name", () => {
    expect(
      toRaciRuleInput({
        grants: { I: "allow" },
        subject: { id: "mock-group-db", kind: "group", name: "DB team" },
      }),
    ).toEqual({
      grants: [{ action: "I", value: "allow" }],
      subjectId: "mock-group-db",
      subjectKind: "group",
      subjectName: "DB team",
    });
  });

  it("writes everyone with an empty name", () => {
    expect(
      toRaciRuleInput({ grants: {}, subject: { kind: "everyone", name: "Everyone" } }),
    ).toEqual({ grants: [], subjectKind: "everyone", subjectName: "" });
  });
});
