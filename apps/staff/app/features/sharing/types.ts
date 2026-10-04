import type { Refusal } from "@sneakers-web/shell";
import type {
  InheritedOwner,
  InheritedRule,
  RaciDecisionView,
  RulesetDraft,
  RulesetSubject,
} from "@sneakers-web/shell";

/** Someone who can't read the folder or secret learns only who owns it. */
export interface NoAccessData extends Base {
  mode: "none";
  ownerNames: string[];
}

export interface RulesetData extends Base {
  canEditEveryone: boolean;
  eyebrow: string;
  id: string;
  inherited: InheritedRule[];
  inheritedOwners: InheritedOwner[];
  labels: Record<string, string>;
  /** "edit" for an owner or site admin, "view" for everyone else who may read the ruleset. */
  mode: "edit" | "view";
  ownerNames: string[];
  secretCount: null | number;
  subjectOptions: RulesetSubject[];
  subtitle: string;
  value: RulesetDraft;
}

export type SharingData = NoAccessData | RulesetData;

export type SharingKind = "folder" | "secret";

export type SharingResult =
  | { decision: RaciDecisionView; intent: "simulate"; ok: true }
  | { done: string; intent: "save"; ok: true }
  | { intent: "search"; ok: true; people: RulesetSubject[] }
  | { intent: string; ok: false; refusal: Refusal };

interface Base {
  backTo: string;
  kind: SharingKind;
  title: string;
}
