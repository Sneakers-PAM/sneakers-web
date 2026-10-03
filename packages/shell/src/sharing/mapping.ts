import type {
  RaciActionKey,
  RaciGrantValue,
  RulesetRule,
  RulesetSubject,
} from "#shell/sharing/types";

import { RACI_ACTIONS } from "#shell/sharing/types";

const ACTIONS = new Set<string>(RACI_ACTIONS.map((a) => a.key));
const GRANTS = new Set<string>(["allow", "deny"]);

export interface RaciRuleInputShape {
  grants: { action: RaciActionKey; value: RaciGrantValue }[];
  subjectId?: string;
  subjectKind: "everyone" | "group" | "user";
  subjectName: string;
}

export interface RaciRuleLike {
  grants: { action: string; value: string }[];
  subjectId?: null | string;
  subjectKind: string;
  subjectName: string;
}

const subjectOf = (rule: RaciRuleLike, labels: Record<string, string>): RulesetSubject => {
  if (rule.subjectKind === "user") {
    // The vault matches a user rule on subjectName, which holds the user id.
    return {
      id: rule.subjectName,
      kind: "user",
      name: labels[rule.subjectName] ?? rule.subjectName,
    };
  }
  if (rule.subjectKind === "group") {
    return { id: rule.subjectId ?? undefined, kind: "group", name: rule.subjectName };
  }
  return { kind: "everyone", name: "Everyone" };
};

/** A gateway RaciRule (or InheritedRaciRule.rule) as an editor rule. Unknown cells are dropped. */
export const fromRaciRule = (
  rule: RaciRuleLike,
  labels: Record<string, string> = {},
): RulesetRule => {
  const grants: RulesetRule["grants"] = {};
  for (const g of rule.grants) {
    if (ACTIONS.has(g.action) && GRANTS.has(g.value)) {
      grants[g.action as RaciActionKey] = g.value as RaciGrantValue;
    }
  }
  return { grants, subject: subjectOf(rule, labels) };
};

/** An editor rule as the gateway's RaciRuleInput, for setFolderRuleset / setSecretRuleset. */
export const toRaciRuleInput = (rule: RulesetRule): RaciRuleInputShape => {
  const grants = RACI_ACTIONS.flatMap(({ key }) => {
    const value = rule.grants[key];
    return value ? [{ action: key, value }] : [];
  });
  const { subject } = rule;
  if (subject.kind === "user") {
    return { grants, subjectKind: "user", subjectName: subject.id ?? subject.name };
  }
  if (subject.kind === "group") {
    return { grants, subjectId: subject.id, subjectKind: "group", subjectName: subject.name };
  }
  return { grants, subjectKind: "everyone", subjectName: "" };
};
