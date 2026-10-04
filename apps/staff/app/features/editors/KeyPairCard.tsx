import { refusalMessage } from "@sneakers-web/shell";
import { Alert, Button, Field, Input } from "@sneakers-web/ui";
import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";

import type { EditorActionResult } from "@/features/editors/editors.server";
import type { FieldDefinition, Problem, SecretType } from "@/features/editors/validate";

import { FormCard } from "@/features/editors/FormCard";
import { type ImportedKey, ImportKeyDialog } from "@/features/editors/ImportKeyDialog";
import { PickOne } from "@/features/editors/PickOne";

/** The formats the vault's key generator makes. */
export const KEY_FORMATS = ["Ed25519", "RSA 4096", "RSA 2048", "ECDSA P-256"];

/**
 * The type's own key format field, when its choices are the generator's formats. Then the
 * card's format picker is that field; otherwise the card keeps its own and the field stays in
 * the Fields card.
 */
export const formatField = (type: SecretType): FieldDefinition | undefined => {
  const f = type.fields.find((x) => x.key === "keyFormat" && x.kind === "select");
  return f?.options?.length && f.options.every((o) => KEY_FORMATS.includes(o)) ? f : undefined;
};

/** The keys the card looks after, so the Fields card leaves them out. */
export const keyPairKeys = (type: SecretType): Set<string> => {
  const keys = new Set(["passphrase", "privateKey", "publicKey"]);
  if (formatField(type)) keys.add("keyFormat");
  return keys;
};

type Source = "generated" | "imported" | null;

const NOTE: Record<"edit" | "generated" | "imported" | "none", string> = {
  edit: "The stored private key stays. Generate or import a key pair to replace it.",
  generated:
    "Private key generated and stored. You never need to see it; Open SSH session uses it for you.",
  imported: "Private key imported. It's stored on save and never shown here again.",
  none: "Generate a key pair, or import one you already have.",
};

/** U-05 SSH key: generate a key pair in the vault, or import one (D-10). */
export const KeyPairCard = ({
  editing,
  onChange,
  problems,
  type,
  values,
}: {
  editing: boolean;
  onChange: (patch: Record<string, string>) => void;
  problems: Record<string, Problem>;
  type: SecretType;
  values: Record<string, string>;
}) => {
  const fetcher = useFetcher<EditorActionResult>({ key: "editor-key-pair" });
  const typeFormat = formatField(type);
  const [ownFormat, setOwnFormat] = useState(KEY_FORMATS[0] as string);
  const format = typeFormat ? values.keyFormat || (KEY_FORMATS[0] as string) : ownFormat;
  const [source, setSource] = useState<Source>(null);
  const [importing, setImporting] = useState(false);
  const handled = useRef<unknown>(null);
  const result = fetcher.state === "idle" ? fetcher.data : undefined;

  useEffect(() => {
    if (result?.ok && result.intent === "generate-key" && handled.current !== result) {
      handled.current = result;
      onChange({
        passphrase: "",
        privateKey: result.keyPair.privateKey,
        publicKey: result.keyPair.publicKey,
      });
      setSource("generated");
    }
  }, [result, onChange]);

  const generate = (f: string) =>
    void fetcher.submit({ format: f, intent: "generate-key" }, { method: "post" });
  // Once there's a key pair, a new format makes a new one in that format.
  const pickFormat = (f: string) => {
    if (typeFormat) onChange({ keyFormat: f });
    else setOwnFormat(f);
    if (values.publicKey) generate(f);
  };
  const imported = (k: ImportedKey) => {
    onChange({ passphrase: k.passphrase, privateKey: k.privateKey, publicKey: k.publicKey });
    setSource("imported");
  };

  const refusal = result && !result.ok ? result.refusal : undefined;
  const keyProblems = ["privateKey", "publicKey", "passphrase"]
    .map((k) => problems[k]?.message)
    .filter(Boolean);
  const note = NOTE[source ?? (editing ? "edit" : "none")];
  return (
    <FormCard title="Key pair">
      <div className="flex flex-wrap items-end gap-3">
        <Field className="w-56" label="Key format">
          <PickOne
            onChange={pickFormat}
            options={(typeFormat?.options ?? KEY_FORMATS).map((f) => ({ label: f, value: f }))}
            value={format}
          />
        </Field>
        <Button
          loading={fetcher.state !== "idle"}
          loadingLabel="Generating…"
          onClick={() => generate(format)}
          type="button"
        >
          Generate key pair
        </Button>
        <Button onClick={() => setImporting(true)} type="button" variant="secondary">
          Import existing key…
        </Button>
      </div>
      <Field error={problems.publicKey?.message} label="Public key">
        <Input
          mono
          placeholder="Generated or imported with the private key"
          readOnly
          value={values.publicKey ?? ""}
        />
      </Field>
      <div className="flex flex-wrap items-center gap-3 rounded-md bg-sunken px-4 py-3 text-small text-muted">
        <span aria-hidden className="font-mono tracking-[0.2em]">
          {"•".repeat(16)}
        </span>
        <span>{note}</span>
      </div>
      {keyProblems.length > 0 && !problems.publicKey && (
        <Alert tone="danger">{keyProblems.join(" ")}</Alert>
      )}
      {refusal && <Alert tone="danger">{refusalMessage(refusal)}</Alert>}
      <ImportKeyDialog onClose={() => setImporting(false)} onImport={imported} open={importing} />
    </FormCard>
  );
};
