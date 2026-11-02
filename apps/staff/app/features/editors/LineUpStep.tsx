import { Card, CardHeader, cn, Pill } from "@sneakers-web/ui";
import { ArrowRight, Ban, Check, GripVertical, NotebookPen, X } from "lucide-react";
import { type DragEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";

import type { Policy } from "@/features/editors/policy";

import { FieldControl } from "@/features/editors/FieldControl";
import {
  type Assessment,
  type Item,
  itemId,
  move,
  notesField,
  type StoredField,
  swap,
  visibleItems,
} from "@/features/editors/lineUp";
import { isSensitive, type SecretType } from "@/features/editors/validate";

const SensitiveTag = () => (
  <Pill className="shrink-0" tone="warn">
    sensitive
  </Pill>
);

const CheckLine = ({ children, ok }: { children: string; ok: boolean }) => (
  <li className={cn("flex items-start gap-2 text-body", ok ? "text-ink" : "text-danger")}>
    {ok ? (
      <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-ok" />
    ) : (
      <X aria-hidden className="mt-0.5 size-4 shrink-0" />
    )}
    <span>{children}</span>
  </li>
);

const okLine = (r: Assessment["rows"][number]) => {
  switch (r.outcome) {
    case "moved": {
      return `${r.from.label} moves to ${r.toLabel}.`;
    }
    case "notes": {
      return `${r.from.label} goes to ${r.toLabel}.`;
    }
    case "own": {
      return `${r.from.label} keeps its own field, ${r.toLabel}.`;
    }
    default: {
      return `${r.from.label} stays in ${r.toLabel}.`;
    }
  }
};

/**
 * Step 1: the stored fields, fixed, by name only, against the new type's fields, which move by
 * drag or by the arrow keys. The check under them runs on every move and every keystroke.
 */
export const LineUpStep = ({
  assessment,
  focusKey,
  left,
  onOrder,
  onTyped,
  order,
  policies,
  to,
  typed,
  vaultProblem,
}: {
  assessment: Assessment;
  /** A stored key whose card takes focus, when the review sends the person back to it. */
  focusKey?: string;
  left: StoredField[];
  onOrder: (order: Item[]) => void;
  onTyped: (key: string, value: string) => void;
  order: Item[];
  policies: Policy[];
  to: SecretType;
  typed: Record<string, string>;
  /** The vault's own refusal, when the page's check found nothing but the preview still says no. */
  vaultProblem: null | string;
}) => {
  const rows = left.length;
  const shown = visibleItems(order, rows);
  const notes = notesField(to);
  const cards = useRef(new Map<string, HTMLButtonElement>());
  const [focus, setFocus] = useState<null | string>(() => {
    const at = left.findIndex((f) => f.key === focusKey);
    const item = at === -1 ? undefined : order[at];
    return item ? itemId(item) : null;
  });
  const dragging = useRef<null | number>(null);

  useEffect(() => {
    if (focus) cards.current.get(focus)?.focus();
  }, [focus, order]);

  const fieldOf = (key: string) => to.fields.find((f) => f.key === key);
  const labelOf = (item: Item) =>
    item.kind === "field"
      ? (fieldOf(item.key)?.label ?? item.key)
      : notes
        ? `Goes to ${notes.label}`
        : "No field";

  const onKey = (event: KeyboardEvent, position: number, item: Item) => {
    const delta = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
    if (!delta) return;
    event.preventDefault();
    const next = move(order, rows, position, delta);
    if (next === order) return;
    setFocus(itemId(item));
    onOrder(next);
  };

  const onDrop = (event: DragEvent, index: number) => {
    event.preventDefault();
    const from = dragging.current;
    dragging.current = null;
    if (from === null) return;
    onOrder(swap(order, from, index));
  };

  const problemAt = (n: number) => assessment.rows[n]?.problem;
  const fills = assessment.unfilled;

  return (
    <>
      <Card>
        <CardHeader
          subtitle="Line each stored field up with where it goes. Values aren't shown here."
          title="Line up the fields"
        />
        <div className="flex flex-col gap-2 p-5.5">
          {rows === 0 && (
            <p className="m-0 text-body text-muted">This secret has no stored values to move.</p>
          )}
          <div className="grid grid-cols-[minmax(0,1fr)_2rem_minmax(0,1fr)] items-center gap-x-2 gap-y-2">
            <span className="eyebrow">Current fields (fixed)</span>
            <span />
            <span className="eyebrow">New fields: drag or use the arrow keys</span>
            {shown.map(({ index, item }, position) => {
              const row = index < rows ? left[index] : undefined;
              const problem = row ? problemAt(index) : undefined;
              const label = labelOf(item);
              const target = item.kind === "field" ? fieldOf(item.key) : undefined;
              const id = itemId(item);
              return (
                <div className="contents" key={id}>
                  {row ? (
                    <div
                      className="flex min-h-11 min-w-0 items-center gap-2 rounded-md border border-border bg-sunken px-3"
                      data-testid="stored-field"
                    >
                      <span className="truncate font-bold">{row.label}</span>
                      {row.sensitive && <SensitiveTag />}
                    </div>
                  ) : (
                    <span />
                  )}
                  <span className="flex justify-center">
                    {row &&
                      (problem ? (
                        <Ban aria-hidden className="size-4 text-danger" />
                      ) : (
                        <ArrowRight aria-hidden className="size-4 text-muted" />
                      ))}
                  </span>
                  <button
                    aria-label={`${label}, ${row ? `lined up against ${row.label}` : "not lined up"}. Use the arrow keys to move it.`}
                    className={cn(
                      "flex min-h-11 min-w-0 cursor-grab items-center gap-2 rounded-md border px-3 text-left",
                      "focus-visible:outline-2 focus-visible:outline-primary",
                      item.kind === "notes"
                        ? "border-dashed border-border-strong text-muted"
                        : "border-border bg-surface",
                      problem && "border-danger",
                    )}
                    data-item={id}
                    draggable
                    onDragOver={(event) => event.preventDefault()}
                    onDragStart={() => {
                      dragging.current = index;
                    }}
                    onDrop={(event) => onDrop(event, index)}
                    onKeyDown={(event) => onKey(event, position, item)}
                    ref={(element) => {
                      if (element) cards.current.set(id, element);
                      else cards.current.delete(id);
                    }}
                    type="button"
                  >
                    <GripVertical aria-hidden className="size-4 shrink-0 text-muted" />
                    {item.kind === "notes" && (
                      <NotebookPen aria-hidden className="size-4 shrink-0" />
                    )}
                    <span className="truncate">{label}</span>
                    {target && isSensitive(target) && <SensitiveTag />}
                  </button>
                </div>
              );
            })}
          </div>
          <p className="m-0 text-small text-muted">
            Name, id, folder and history aren&apos;t shown: they carry over unchanged.
          </p>
        </div>
      </Card>

      {fills.length > 0 && (
        <Card aria-label="Fields the new type still needs">
          <CardHeader subtitle="No stored value fills these." title={`${to.name} also has`} />
          <div className="grid gap-4 p-5.5 tablet:grid-cols-2">
            {fills.map((f) => (
              <div className="relative flex flex-col" key={f.key}>
                {f.required && (
                  <Pill className="absolute top-0 right-0" tone="warn">
                    Required
                  </Pill>
                )}
                <FieldControl
                  editing={false}
                  field={f}
                  onChange={(value) => onTyped(f.key, value)}
                  policies={policies}
                  value={typed[f.key] ?? ""}
                />
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card aria-label="Check" aria-live="polite">
        <CardHeader title="Check" />
        <ul className="m-0 flex list-none flex-col gap-2 p-5.5">
          {assessment.rows.map((r) => (
            <CheckLine key={r.from.key} ok={!r.problem}>
              {r.problem ?? okLine(r)}
            </CheckLine>
          ))}
          <CheckLine ok>
            {assessment.toNotes.length === 0
              ? "Nothing goes to Notes."
              : `${assessment.toNotes.length === 1 ? "One field goes" : `${assessment.toNotes.length} fields go`} to ${notes?.label ?? "Notes"}, with a line saying where each came from.`}
          </CheckLine>
          {assessment.missing.map((f) => (
            <CheckLine key={f.key} ok={false}>
              {`${f.label} is required. Fill it in above.`}
            </CheckLine>
          ))}
          {vaultProblem && <CheckLine ok={false}>{vaultProblem}</CheckLine>}
        </ul>
      </Card>
    </>
  );
};
