import type {
  RaciActionKey,
  RaciGrantValue,
  RulesetRule,
  RulesetSubject,
} from "#shell/sharing/types";

/** Whether two subjects are the same person, group or everyone (names may differ). */
export const sameSubject = (a: RulesetSubject, b: RulesetSubject): boolean =>
  a.kind === b.kind && (a.kind === "everyone" || a.id === b.id);

export const setGrant = (
  rules: RulesetRule[],
  index: number,
  action: RaciActionKey,
  value: RaciGrantValue | undefined,
): RulesetRule[] =>
  rules.map((r, index_) => {
    if (index_ !== index) return r;
    const grants = { ...r.grants };
    if (value) grants[action] = value;
    else delete grants[action];
    return { ...r, grants };
  });

const NEXT: Record<string, RaciGrantValue | undefined> = {
  allow: "deny",
  deny: undefined,
  none: "allow",
};

/** One click on an Advanced cell: blank, then allow, then deny, then blank again. */
export const cycleGrant = (rules: RulesetRule[], index: number, action: RaciActionKey) =>
  setGrant(rules, index, action, NEXT[rules[index]?.grants[action] ?? "none"]);

export const moveRule = (rules: RulesetRule[], index: number, by: -1 | 1): RulesetRule[] => {
  const to = index + by;
  if (to < 0 || to >= rules.length) return rules;
  const out = [...rules];
  [out[index], out[to]] = [out[to] as RulesetRule, out[index] as RulesetRule];
  return out;
};

/** A new rule goes to the bottom of this folder's list. A subject already listed is left alone. */
export const addRule = (
  rules: RulesetRule[],
  subject: RulesetSubject,
  grants: RulesetRule["grants"],
): RulesetRule[] =>
  rules.some((r) => sameSubject(r.subject, subject)) ? rules : [...rules, { grants, subject }];

export const removeRule = (rules: RulesetRule[], index: number): RulesetRule[] =>
  rules.filter((_, index_) => index_ !== index);
