import type { RulesetRule } from "#shell/sharing/types";

import {
  addRule,
  cycleGrant,
  moveRule,
  removeRule,
  sameSubject,
  setGrant,
} from "#shell/sharing/draft";

const dave: RulesetRule = {
  grants: { C: "deny" },
  subject: { id: "mock-user-dave", kind: "user", name: "Dave" },
};
const database: RulesetRule = {
  grants: { C: "allow" },
  subject: { id: "mock-group-db", kind: "group", name: "DB team" },
};

describe("draft edits", () => {
  it("cycles a cell from blank to allow to deny and back to blank", () => {
    const blank = cycleGrant([database], 0, "R");
    expect(blank[0]?.grants.R).toBe("allow");
    expect(cycleGrant(blank, 0, "R")[0]?.grants.R).toBe("deny");
    expect(cycleGrant(cycleGrant(blank, 0, "R"), 0, "R")[0]?.grants).toEqual({ C: "allow" });
  });

  it("sets or clears one cell, leaving the original untouched", () => {
    const rules = [database];
    expect(setGrant(rules, 0, "I", "allow")[0]?.grants).toEqual({ C: "allow", I: "allow" });
    expect(setGrant(rules, 0, "C", undefined)[0]?.grants).toEqual({});
    expect(rules[0]?.grants).toEqual({ C: "allow" });
  });

  it("moves a rule up or down, and ignores a move off either end", () => {
    expect(moveRule([dave, database], 1, -1)).toEqual([database, dave]);
    expect(moveRule([dave, database], 0, 1)).toEqual([database, dave]);
    expect(moveRule([dave, database], 0, -1)).toEqual([dave, database]);
    expect(moveRule([dave, database], 1, 1)).toEqual([dave, database]);
  });

  it("adds a rule at the bottom, never twice for the same subject", () => {
    const added = addRule([dave], database.subject, { C: "allow" });
    expect(added).toEqual([dave, database]);
    expect(addRule(added, { ...database.subject, name: "renamed" }, {})).toBe(added);
  });

  it("removes a rule", () => {
    expect(removeRule([dave, database], 0)).toEqual([database]);
  });

  it("matches subjects by kind and id", () => {
    expect(sameSubject(dave.subject, { id: "mock-user-dave", kind: "user", name: "x" })).toBe(true);
    expect(sameSubject(dave.subject, database.subject)).toBe(false);
    expect(
      sameSubject({ kind: "everyone", name: "Everyone" }, { kind: "everyone", name: "" }),
    ).toBe(true);
  });
});
