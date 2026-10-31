import { type Refusal, refusalMessage } from "@sneakers-web/shell";

import type { ChangeTypePreview } from "@/features/editors/changeType.server";
import type { SecretType } from "@/features/editors/validate";

export const CHANGE_TYPE_ROUTE = "/resources/change-type";

/** A secret the flow changes. `typeId` lets a selection skip those already on the new type. */
export interface ChangeSubject {
  id: string;
  name: string;
  typeId: string;
}

export type FieldLabel = (key: string) => string;

/** A field's label under the new type, else under the old one, else its key. */
export const fieldLabeller =
  (to: SecretType, from: SecretType | undefined): FieldLabel =>
  (key) =>
    to.fields.find((f) => f.key === key)?.label ??
    from?.fields.find((f) => f.key === key)?.label ??
    key;

export const notesFieldOf = (t: SecretType) =>
  t.fields.find((f) => f.key === "notes" || f.key === "note")?.key;

/** The vault's refusals name keys and its own arguments; this names fields in the page's words. */
export const typeChangeRefusal = (r: Refusal, label: FieldLabel): string => {
  const keys = (r.metadata.fields ?? "").split(",").filter(Boolean);
  const names = keys.map((k) => label(k)).join(", ");
  if (keys.length === 0) return refusalMessage(r);
  switch (r.reason) {
    case "TYPE_CHANGE_LOWERS_PROTECTION": {
      return `${names}: a sensitive value can't move to a less protected field. Pick a sensitive field for it.`;
    }
    case "TYPE_CHANGE_NOTES_TOO_LONG": {
      return `${names}: moving this to notes would pass the notes field's length limit.`;
    }
    case "TYPE_CHANGE_UNMAPPED_FIELDS": {
      return `${names}: there's no field for this under the new type. Pick one for it.`;
    }
    default: {
      return `${names}: ${refusalMessage(r)}`;
    }
  }
};

/** A preview that says no, as the refusal the change itself would give, naming blocked fields. */
export const previewRefusal = (p: ChangeTypePreview): null | Refusal => {
  if (p.allowed) return null;
  const blocked = p.fieldChanges.filter((c) => c.outcome === "blocked").map((c) => c.fromKey);
  return {
    code: "FAILED_PRECONDITION",
    detail: p.refusalMessage ?? "",
    metadata: { fields: blocked.join(",") },
    reason: p.refusalReason ?? undefined,
  };
};

const ROTATION: Record<string, string> = {
  none: "The new type doesn't rotate.",
  off: "Off until you turn it on.",
};

const HEARTBEAT: Record<string, string> = {
  no_target: "Waits for a target with a connection.",
  none: "The new type has no heartbeat.",
  opted_out: "Stays off: this secret opted out.",
  scheduled: "Starts on its schedule.",
};

/** What the change does to automation, in a sentence each. Unknown values show as sent. */
export const automationLines = (
  p: ChangeTypePreview,
  targetName: (id: string) => string,
): { label: string; text: string }[] => {
  const target = () => {
    if (p.target === "kept") return `Stays on ${targetName(p.targetId ?? "")}.`;
    if (p.target === "detached") {
      return `${targetName(p.fromTargetId ?? "")} is detached: the new type doesn't take a target.`;
    }
    return p.target === "none" ? "None attached." : p.target;
  };
  return [
    { label: "Rotation", text: ROTATION[p.rotation] ?? p.rotation },
    { label: "Heartbeat", text: HEARTBEAT[p.heartbeat] ?? p.heartbeat },
    { label: "Target", text: target() },
  ];
};
