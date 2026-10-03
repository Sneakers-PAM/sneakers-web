export interface InheritedOwner {
  fromFolderId: string;
  fromFolderName: string;
  name: string;
  userId: string;
}

export interface InheritedRule extends RulesetRule {
  fromFolderId: string;
  fromFolderName: string;
}

/** The four governed RACI actions: C reveal, I informed, A approve, R manage. */
export type RaciActionKey = "A" | "C" | "I" | "R";

export interface RaciDecisionView {
  approve: boolean;
  approveReason: string;
  informed: boolean;
  informedReason: string;
  manage: boolean;
  manageReason: string;
  read: boolean;
  readReason: string;
  reveal: boolean;
  revealReason: string;
}

/** A cell: an explicit grant, or absent for "inherit". */
export type RaciGrantValue = "allow" | "deny";

export interface RulesetDraft {
  /** Folders only. Undefined for a secret. */
  owners?: string[];
  rules: RulesetRule[];
}

export interface RulesetEditorProps {
  /** Whether "everyone" rules can be changed. Only site admins may; defaults to false. */
  canEditEveryone?: boolean;
  inherited: InheritedRule[];
  inheritedOwners?: InheritedOwner[];
  /** Display names for ids in `value.owners` and the rules. */
  labels: Record<string, string>;
  /** Every edit hands back the whole draft. */
  onChange: (draft: RulesetDraft) => void;
  /** When set, everything is shown and nothing can be changed, with this sentence. */
  readOnlyReason?: string;
  scope: "folder" | "secret";
  /** Typeahead for more people; the app answers it through its own route (`searchUsers`). */
  searchSubjects?: (query: string) => Promise<RulesetSubject[]>;
  /** Picker options: groups and users the app already knows. */
  subjectOptions: RulesetSubject[];
  /** The saved state the editor starts from. Remount with a new key to reset it. */
  value: RulesetDraft;
}

export interface RulesetRule {
  /** A missing action is "inherit": it falls through to the next rule. */
  grants: Partial<Record<RaciActionKey, RaciGrantValue>>;
  subject: RulesetSubject;
}

export interface RulesetSimulatorProps {
  searchUsers: (query: string) => Promise<RulesetSubject[]>;
  /** Runs `simulateFolder` / `simulateSecret` with the current draft; a new function reruns it. */
  simulate: (userId: string) => Promise<RaciDecisionView>;
}

export interface RulesetSubject {
  /** The user or group id; absent for everyone. Group rules always carry it. */
  id?: string;
  kind: "everyone" | "group" | "user";
  name: string;
}

/** The actions in the gateway's order (C, I, A, R), with the words the screens use. */
export const RACI_ACTIONS: { key: RaciActionKey; label: string }[] = [
  { key: "C", label: "Reveal" },
  { key: "I", label: "Informed" },
  { key: "A", label: "Approve" },
  { key: "R", label: "Manage" },
];
