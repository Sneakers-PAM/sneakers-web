import { Button, toast } from "@sneakers-web/ui";
import { Copy, RefreshCw } from "lucide-react";

import type { SecretType } from "@/features/secret/secret.server";

import { Panel, Row } from "@/features/secret/Panel";
import { SensitiveValue } from "@/features/secret/SensitiveValue";

type FieldDefinition = SecretType["fields"][number];

export const isSecretField = (f: Pick<FieldDefinition, "kind" | "sensitive" | "superSensitive">) =>
  f.kind === "password" || !!f.sensitive || !!f.superSensitive;

const Plain = ({ field, value }: { field: FieldDefinition; value: string | undefined }) => {
  if (value === undefined || value === "") return <span className="text-muted">—</span>;
  if (field.kind === "multiline")
    return <p className="m-0 rounded-md bg-sunken px-4 py-3 whitespace-pre-wrap">{value}</p>;
  if (field.kind === "boolean") return <span>{value === "true" ? "Yes" : "No"}</span>;
  return (
    <div className="flex items-center gap-3">
      <span className="min-w-0 font-mono text-value break-all">{value}</span>
      <Button
        aria-label={`Copy ${field.label}`}
        className="ml-auto"
        onClick={() =>
          void navigator.clipboard
            .writeText(value)
            .then(() => toast(`${field.label} copied.`))
            .catch(() => toast.error("Couldn't copy."))
        }
        size="sm"
        variant="secondary"
      >
        <Copy aria-hidden />
        Copy
      </Button>
    </div>
  );
};

/** The type's fields: plain values inline, secret ones masked behind a reveal. */
export const FieldsCard = ({
  fields,
  locked,
  plainHidden,
  rotatesOnCheckIn,
  type,
}: {
  fields: Record<string, string>;
  /** Why secret values can't be revealed now, or undefined when they can. */
  locked?: string;
  /** The person can't read the secret, so even plain values aren't shown. */
  plainHidden: boolean;
  rotatesOnCheckIn: boolean;
  type: SecretType;
}) => (
  <Panel subtitle="Revealing or copying a value is recorded in the audit log." title="Fields">
    {type.fields.length === 0 ? (
      <p className="m-0 px-6 py-5 text-muted">This type has no fields.</p>
    ) : (
      type.fields.map((f) => (
        <Row
          key={f.key}
          label={f.label}
          note={
            f.superSensitive ? (
              <span className="font-mono text-[0.75rem] text-warn">super-sensitive</span>
            ) : undefined
          }
        >
          {isSecretField(f) ? (
            <SensitiveValue
              field={f}
              hint={
                f.rotates && rotatesOnCheckIn ? (
                  <span className="inline-flex items-center gap-1.5">
                    <RefreshCw aria-hidden className="size-3.5" />
                    Rotates to a new value on check-in
                  </span>
                ) : undefined
              }
              locked={locked}
              target={{ fieldKey: f.key }}
            />
          ) : plainHidden ? (
            <span className="text-muted">Hidden until you have access</span>
          ) : (
            <Plain field={f} value={fields[f.key]} />
          )}
        </Row>
      ))
    )}
  </Panel>
);
