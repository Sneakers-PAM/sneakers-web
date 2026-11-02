import { type FieldDefinition, isSensitive, type SecretType } from "@/features/editors/validate";

/*
 * Lining up a secret's stored fields against a new type's fields, as the change-type page does
 * before it asks the vault. The rules match the vault's (sneakers-vault docs/type-change.md): a
 * value with no field of its own goes to the new type's notes, a key that keeps its name stays
 * where it is unless it's moved, and sensitivity never drops. Keys and labels only, never values.
 */

export interface Assessment {
  /** What to send the vault as `fieldMapping`: only values that land under another key. */
  mapping: { from: string; to: string }[];
  /** Required fields of the new type nothing fills and nothing has been typed for. */
  missing: FieldDefinition[];
  problems: string[];
  rows: RowResult[];
  /** Stored keys that go to the new type's notes. */
  toNotes: string[];
  /** The new type's fields no stored value fills: the page asks for these. */
  unfilled: FieldDefinition[];
}

/** A card in the right column: a field of the new type, or a "goes to Notes" placeholder. */
export type Item = { id: number; kind: "notes" } | { key: string; kind: "field" };

export type Outcome = "moved" | "none" | "notes" | "own" | "same";

export interface RowResult {
  from: StoredField;
  outcome: Outcome;
  problem?: string;
  /** The field it lands in; the notes field for "notes", null for "none". */
  toKey: null | string;
  toLabel: string;
}

/** One stored value of the secret, by key: what the left column shows. */
export interface StoredField {
  key: string;
  label: string;
  sensitive: boolean;
  superSensitive: boolean;
}

export const itemId = (index: Item): string =>
  index.kind === "field" ? `field:${index.key}` : `notes:${index.id}`;

/** The stored keys, in the current type's field order, then any it doesn't declare. */
export const storedFields = (keys: string[], from: SecretType | undefined): StoredField[] => {
  const declared = from?.fields ?? [];
  const order = (k: string) => {
    const at = declared.findIndex((f) => f.key === k);
    return at === -1 ? declared.length : at;
  };
  return [...new Set(keys)]
    .toSorted((a, b) => order(a) - order(b) || a.localeCompare(b))
    .map((key) => {
      const f = declared.find((d) => d.key === key);
      // A stored key the type doesn't declare counts as sensitive, as in the vault.
      if (!f) return { key, label: key, sensitive: true, superSensitive: false };
      return {
        key,
        label: f.label,
        sensitive: isSensitive(f),
        superSensitive: !!f.superSensitive,
      };
    });
};

export const notesField = (t: SecretType): FieldDefinition | undefined =>
  t.fields.find((f) => f.key === "notes" || f.key === "note");

/** Whether moving `from`'s value into `to` would lower its protection. */
export const lowers = (from: StoredField, to: FieldDefinition): boolean =>
  (from.sensitive && !isSensitive(to)) || (from.superSensitive && !to.superSensitive);

/**
 * The starting line-up: a value keeps a field with its own name where it can; a sensitive one
 * is offered the new type's free sensitive fields, required ones first; anything else goes to
 * Notes. The first `left.length` items line up against the rows; the rest follow.
 */
export const propose = (left: StoredField[], to: SecretType): Item[] => {
  const used = new Set<string>();
  const slots: (null | string)[] = left.map((row) => {
    const own = to.fields.find((f) => f.key === row.key);
    if (own && !lowers(row, own)) {
      used.add(own.key);
      return own.key;
    }
    return null;
  });
  const notes = notesField(to);
  for (const [n, row] of left.entries()) {
    if (slots[n] !== null) continue;
    const free = to.fields.filter((f) => !used.has(f.key) && f.key !== notes?.key);
    let pick: FieldDefinition | undefined;
    if (row.sensitive) {
      pick = free
        .filter((f) => isSensitive(f) && !lowers(row, f))
        .toSorted((a, b) => Number(!!b.required) - Number(!!a.required))[0];
    } else if (!notes || lowers(row, notes)) {
      pick = free.find((f) => f.label.toLowerCase() === row.label.toLowerCase()) ?? free[0];
    }
    if (pick) {
      used.add(pick.key);
      slots[n] = pick.key;
    }
  }
  let placeholders = 0;
  const lined: Item[] = slots.map((key) =>
    key === null ? { id: placeholders++, kind: "notes" } : { key, kind: "field" },
  );
  const rest: Item[] = to.fields
    .filter((f) => !used.has(f.key))
    .map((f) => ({ key: f.key, kind: "field" }));
  const spare: Item[] = Array.from({ length: left.length - placeholders }, () => ({
    id: placeholders++,
    kind: "notes",
  }));
  return [...lined, ...rest, ...spare];
};

/**
 * The cards the right column draws, with where each sits in `order`: every card against a row,
 * then the fields not lined up, then one Notes card to drag in while any is spare.
 */
export const visibleItems = (order: Item[], rows: number): { index: number; item: Item }[] => {
  let spareShown = false;
  return order.flatMap((item, index) => {
    if (index < rows || item.kind === "field") return [{ index, item }];
    if (spareShown) return [];
    spareShown = true;
    return [{ index, item }];
  });
};

export const swap = (order: Item[], a: number, b: number): Item[] => {
  if (a === b || !order[a] || !order[b]) return order;
  const next = [...order];
  [next[a], next[b]] = [next[b] as Item, next[a] as Item];
  return next;
};

/** Move the card at `position` among the drawn cards one place up (-1) or down (1). */
export const move = (order: Item[], rows: number, position: number, delta: -1 | 1): Item[] => {
  const shown = visibleItems(order, rows);
  const here = shown[position];
  const there = shown[position + delta];
  if (!here || !there) return order;
  return swap(order, here.index, there.index);
};

/** Where each stored value lands for this line-up, and what's wrong with it, in plain words. */
export const assess = (
  left: StoredField[],
  order: Item[],
  to: SecretType,
  typed: Record<string, string>,
): Assessment => {
  const notes = notesField(to);
  const fieldOf = (key: string) => to.fields.find((f) => f.key === key);
  const anySensitive = to.fields.some((f) => isSensitive(f));
  const lined = new Map<string, string>();
  for (const [n, row] of left.entries()) {
    const item = order[n];
    if (item?.kind === "field") lined.set(item.key, row.label);
  }

  const rows: RowResult[] = left.map((from, n) => {
    const item = order[n];
    if (item?.kind === "field") {
      const target = fieldOf(item.key);
      const result: RowResult = {
        from,
        outcome: item.key === from.key ? "same" : "moved",
        toKey: item.key,
        toLabel: target?.label ?? item.key,
      };
      if (target && lowers(from, target)) {
        result.problem = `${from.label} is sensitive and can't go into ${target.label}. Move a sensitive field next to it.`;
      }
      return result;
    }
    const own = fieldOf(from.key);
    if (own) {
      const result: RowResult = { from, outcome: "own", toKey: own.key, toLabel: own.label };
      const other = lined.get(own.key);
      if (other) {
        result.problem = `${from.label} keeps its own field, ${own.label}, which is lined up against ${other}. Move another field next to ${from.label}.`;
      } else if (lowers(from, own)) {
        result.problem = `${from.label} is sensitive and can't stay in ${own.label}. Move a sensitive field next to it.`;
      }
      return result;
    }
    if (!notes) {
      return {
        from,
        outcome: "none",
        problem: `${from.label} has no field under ${to.name}, and ${to.name} has no Notes. Move a field next to it.`,
        toKey: null,
        toLabel: "No field",
      };
    }
    const result: RowResult = { from, outcome: "notes", toKey: notes.key, toLabel: notes.label };
    if (lowers(from, notes)) {
      result.problem = anySensitive
        ? `${from.label} is sensitive and can't go to ${notes.label}. Move a sensitive field next to it.`
        : `${from.label} is sensitive, and ${to.name} has no sensitive field to take it. Pick another type.`;
    }
    return result;
  });

  const toNotes = rows.filter((r) => r.outcome === "notes").map((r) => r.from.key);
  const filled = new Set(
    rows.filter((r) => r.outcome !== "notes" && r.toKey).map((r) => r.toKey as string),
  );
  if (toNotes.length > 0 && notes) filled.add(notes.key);
  const unfilled = to.fields.filter((f) => !filled.has(f.key));
  return {
    mapping: rows
      .filter((r) => r.outcome === "moved" && r.toKey)
      .map((r) => ({ from: r.from.key, to: r.toKey as string })),
    missing: unfilled.filter((f) => f.required && !typed[f.key]?.trim()),
    problems: rows.flatMap((r) => (r.problem ? [r.problem] : [])),
    rows,
    toNotes,
    unfilled,
  };
};
