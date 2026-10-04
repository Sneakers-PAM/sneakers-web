import { Button, Checkbox, cn, Field, Input, Textarea } from "@sneakers-web/ui";
import { Eye, EyeOff, RefreshCw } from "lucide-react";
import { useState } from "react";

import { formatField } from "@/features/editors/format";
import { PickOne } from "@/features/editors/PickOne";
import { generatePassword, type Policy, policyChecks, policyFor } from "@/features/editors/policy";
import { PolicyChips } from "@/features/editors/PolicyChips";
import { type FieldDefinition, isSensitive, type Problem } from "@/features/editors/validate";

/** Fields set in the mono face, as the frames show (accounts, ports, values to copy). */
const MONO_KEYS = new Set(["host", "hostname", "port", "server", "username"]);

const KEEP = "Leave blank to keep the current value";

/** A field that takes the full width of the form. */
export const isWide = (f: FieldDefinition): boolean =>
  ["multiline", "password", "sensitive"].includes(f.kind);

const noAutofill = { autoComplete: "off", "data-1p-ignore": true, "data-lpignore": "true" };

/** A masked value with a show/hide toggle; generation is offered for password fields. */
const SecretInput = ({
  editing,
  field,
  mustFill,
  onChange,
  onGenerate,
  value,
  ...wiring
}: {
  editing: boolean;
  field: FieldDefinition;
  /** Marks the input required when its label draws the asterisk itself. */
  mustFill?: boolean;
  onChange: (value: string) => void;
  onGenerate?: () => void;
  value: string;
} & Partial<Record<"id" | `aria-${string}`, unknown>>) => {
  const [shown, setShown] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <Input
        {...noAutofill}
        {...(wiring as object)}
        aria-required={mustFill || (wiring["aria-required"] as boolean | undefined)}
        autoComplete="new-password"
        className="flex-1"
        maxLength={field.maxLength || undefined}
        mono
        onChange={(event) => onChange(event.target.value)}
        placeholder={editing ? KEEP : undefined}
        type={shown ? "text" : "password"}
        value={value}
      />
      <Button
        aria-label={`${shown ? "Hide" : "Show"} ${field.label}`}
        aria-pressed={shown}
        onClick={() => setShown((s) => !s)}
        size="icon"
        type="button"
        variant="secondary"
      >
        {shown ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
      </Button>
      {onGenerate && (
        <Button onClick={onGenerate} type="button" variant="secondary">
          <RefreshCw aria-hidden />
          Regenerate
        </Button>
      )}
    </div>
  );
};

/**
 * One field of a secret, drawn by its definition: text, multi-line, password (with generation
 * to its policy), other sensitive values, a switch, or a choice. Anything else is a plain value.
 */
export const FieldControl = ({
  editing,
  field,
  onChange,
  policies,
  problem,
  value,
}: {
  editing: boolean;
  field: FieldDefinition;
  onChange: (value: string) => void;
  policies: Policy[];
  problem?: Problem;
  value: string;
}) => {
  const error = problem?.message;
  const required = !!field.required && !(editing && isSensitive(field));
  const hint = field.superSensitive ? "Super-sensitive: shown as a partial mask first." : undefined;

  if (field.kind === "password") {
    const policy = policyFor(field, policies);
    const strict = field.policyEnforcement === "strict";
    // The asterisk goes before the policy note, as the frames show, so the label draws it.
    const label = (
      <>
        {field.label}
        {required && (
          <span aria-hidden className="text-danger">
            {" "}
            *
          </span>
        )}
        {policy && (
          <span className="font-normal text-muted">
            {" "}
            · {policy.name} policy, {strict ? "strict" : "lax"}
          </span>
        )}
      </>
    );
    return (
      <div className="flex flex-col gap-2">
        <Field error={error} hint={hint} label={label}>
          <SecretInput
            editing={editing}
            field={field}
            mustFill={required}
            onChange={onChange}
            onGenerate={() => onChange(generatePassword(policy))}
            value={value}
          />
        </Field>
        {strict && policy && value && <PolicyChips checks={policyChecks(value, policy)} />}
      </div>
    );
  }

  if (field.kind === "sensitive") {
    return (
      <Field error={error} hint={hint} label={field.label} required={required}>
        <SecretInput
          editing={editing}
          field={field}
          onChange={(raw) => onChange(formatField(field.key, raw))}
          value={value}
        />
      </Field>
    );
  }

  if (field.kind === "multiline") {
    return (
      <Field error={error} hint={hint} label={field.label} required={required}>
        <Textarea
          {...noAutofill}
          maxLength={field.maxLength || undefined}
          mono={isSensitive(field)}
          onChange={(event) => onChange(event.target.value)}
          placeholder={editing && isSensitive(field) ? KEEP : undefined}
          rows={4}
          value={value}
        />
      </Field>
    );
  }

  if (field.kind === "boolean") {
    return (
      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2.5 pt-7 text-body font-bold">
          <Checkbox
            checked={value === "true"}
            onCheckedChange={(v) => onChange(v === true ? "true" : "false")}
          />
          {field.label}
        </label>
      </div>
    );
  }

  if (field.kind === "select") {
    return (
      <Field error={error} label={field.label} required={required}>
        <PickOne
          onChange={onChange}
          options={(field.options ?? []).map((o) => ({ label: o, value: o }))}
          placeholder={`Pick the ${field.label.toLowerCase()}`}
          value={value}
        />
      </Field>
    );
  }

  return (
    <Field error={error} hint={hint} label={field.label} required={required}>
      <Input
        {...noAutofill}
        className={cn(MONO_KEYS.has(field.key) && "font-mono")}
        maxLength={field.maxLength || undefined}
        onChange={(event) => onChange(formatField(field.key, event.target.value))}
        value={value}
      />
    </Field>
  );
};
