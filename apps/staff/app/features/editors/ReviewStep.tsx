import { Button, Card, CardHeader, Pill } from "@sneakers-web/ui";
import { ArrowRight, NotebookPen, Plus } from "lucide-react";
import { type ReactNode, useState } from "react";

import { type Assessment, notesField, type RowResult } from "@/features/editors/lineUp";
import { isSensitive, type SecretType } from "@/features/editors/validate";
import { SensitiveValue } from "@/features/secret/SensitiveValue";

const MASK = "• • • • • • • •";

const Line = ({
  action,
  children,
  detail,
  icon,
  name,
}: {
  action?: ReactNode;
  children: ReactNode;
  detail?: ReactNode;
  icon: ReactNode;
  /** What the line is about, for finding it by name. */
  name?: string;
}) => (
  <li aria-label={name} className="flex flex-col gap-2 border-b border-border py-3 last:border-b-0">
    <div className="flex flex-wrap items-center gap-2 text-body">
      <span className="shrink-0 text-muted">{icon}</span>
      <span className="min-w-0 flex-1">{children}</span>
      {action}
    </div>
    {detail}
  </li>
);

/** A stored non-sensitive value, shown only on asking. */
const ShownValue = ({ label, value }: { label: string; value: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <Button
        aria-label={`${open ? "Hide" : "Show"} ${label}`}
        className="self-start"
        onClick={() => setOpen((o) => !o)}
        size="sm"
        variant="secondary"
      >
        {open ? "Hide" : "Show"}
      </Button>
      {open && (
        <div className="rounded-md border border-border bg-sunken px-3 py-2 font-mono text-[0.875rem] break-all whitespace-pre-wrap">
          {value || <span className="text-muted">Empty</span>}
        </div>
      )}
    </div>
  );
};

/** A value the person typed on step 1. Sensitive ones stay masked until asked. */
const TypedValue = ({
  label,
  sensitive,
  value,
}: {
  label: string;
  sensitive: boolean;
  value: string;
}) => {
  const [open, setOpen] = useState(!sensitive);
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="font-mono break-all">{open ? value : MASK}</span>
      {sensitive && (
        <Button
          aria-label={`${open ? "Hide" : "Show"} ${label}`}
          onClick={() => setOpen((o) => !o)}
          size="sm"
          variant="secondary"
        >
          {open ? "Hide" : "Show"}
        </Button>
      )}
    </span>
  );
};

const what = (r: RowResult) => {
  switch (r.outcome) {
    case "moved": {
      return (
        <>
          <b>{r.from.label}</b> moves to <b>{r.toLabel}</b>
        </>
      );
    }
    case "notes": {
      return (
        <>
          <b>{r.from.label}</b> goes to <b>{r.toLabel}</b>, with a line saying where it came from
        </>
      );
    }
    default: {
      return (
        <>
          <b>{r.from.label}</b> stays in <b>{r.toLabel}</b>
        </>
      );
    }
  }
};

/**
 * Step 2: what moves where, and what goes to Notes, with each value one Show or Reveal away. A
 * reveal goes through the secret's own reveal path, so it's audited and held for approval where
 * the secret asks for one. Nothing changes until Change type.
 */
export const ReviewStep = ({
  assessment,
  onChange,
  to,
  typed,
  values,
}: {
  assessment: Assessment;
  /** Back to step 1, with the stored key (or new field key) to put focus on. */
  onChange: (key: string) => void;
  to: SecretType;
  typed: Record<string, string>;
  /** Non-sensitive stored values, for Show. */
  values: Record<string, string>;
}) => {
  const change = (key: string, label: string) => (
    <Button
      aria-label={`Change ${label}`}
      onClick={() => onChange(key)}
      size="sm"
      variant="secondary"
    >
      Change
    </Button>
  );
  const added = assessment.unfilled.filter((f) => typed[f.key]?.trim());
  return (
    <Card aria-label="Review what moves">
      <CardHeader subtitle="Nothing has changed yet." title="Review what moves" />
      <ul className="m-0 flex list-none flex-col px-5.5 py-2">
        {assessment.rows.map((r) => {
          const unchanged = r.outcome === "same" || r.outcome === "own";
          return (
            <Line
              action={
                unchanged ? (
                  <span className="text-small text-muted">unchanged</span>
                ) : (
                  change(r.from.key, r.from.label)
                )
              }
              detail={
                r.from.sensitive ? (
                  <SensitiveValue
                    compact
                    field={{ label: r.from.label, superSensitive: r.from.superSensitive }}
                    target={{ fieldKey: r.from.key }}
                  />
                ) : (
                  <ShownValue label={r.from.label} value={values[r.from.key] ?? ""} />
                )
              }
              icon={
                r.outcome === "notes" ? (
                  <NotebookPen className="size-4" />
                ) : (
                  <ArrowRight className="size-4" />
                )
              }
              key={r.from.key}
              name={r.from.label}
            >
              {what(r)}
              {r.from.sensitive && (
                <>
                  {" "}
                  <Pill tone="warn">sensitive</Pill>
                </>
              )}
            </Line>
          );
        })}
        {added.map((f) => (
          <Line
            action={change(f.key, f.label)}
            icon={<Plus className="size-4" />}
            key={f.key}
            name={`New field ${f.label}`}
          >
            New field <b>{f.label}</b>:{" "}
            <TypedValue label={f.label} sensitive={isSensitive(f)} value={typed[f.key] ?? ""} />
          </Line>
        ))}
        <Line icon={<NotebookPen className="size-4" />}>
          {assessment.toNotes.length === 0
            ? "Nothing goes to Notes."
            : `${assessment.toNotes.length === 1 ? "One field goes" : `${assessment.toNotes.length} fields go`} to ${notesField(to)?.label ?? "Notes"}.`}{" "}
          Name, id, folder and history carry over. Earlier values stay in the version history.
        </Line>
      </ul>
    </Card>
  );
};
