import { Field, Input } from "@sneakers-web/ui";
import { type ChangeEvent } from "react";

import { readBase64 } from "@/features/editors/files";
import { FormCard } from "@/features/editors/FormCard";
import { PickOne } from "@/features/editors/PickOne";

/** Every container the vault's parser takes on import. */
const ACCEPT = ".p12,.pfx,.p7b,.p7c,.pem,.der,.cer,.crt,.jks,.jceks";

export interface CertificateDraft {
  alias: string;
  fileBase64: string;
  fileName: string;
  passphrase: string;
}

export const EMPTY_CERTIFICATE: CertificateDraft = {
  alias: "",
  fileBase64: "",
  fileName: "",
  passphrase: "",
};

/**
 * A certificate comes in from a file; the vault parses its details. A bundle with several
 * entries comes back as a list, and the person picks one before importing again.
 */
export const CertificateCard = ({
  aliases,
  draft,
  error,
  onChange,
}: {
  aliases: string[];
  draft: CertificateDraft;
  error?: string;
  onChange: (draft: CertificateDraft) => void;
}) => {
  const choose = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    void readBase64(file).then((fileBase64) =>
      onChange({ ...draft, alias: "", fileBase64, fileName: file.name }),
    );
  };
  return (
    <FormCard
      subtitle="PKCS#12 or PFX, PEM, DER, PKCS#7, or a JKS or JCEKS keystore. Its details are read on import."
      title="Certificate"
    >
      <div className="grid gap-x-4 gap-y-5 tablet:grid-cols-2">
        <Field error={error} hint={draft.fileName || undefined} label="Certificate file" required>
          <Input accept={ACCEPT} className="py-2" onChange={choose} type="file" />
        </Field>
        <Field
          label={
            <>
              Passphrase <span className="font-normal text-muted">(if the file has one)</span>
            </>
          }
        >
          <Input
            autoComplete="new-password"
            mono
            onChange={(event) => onChange({ ...draft, passphrase: event.target.value })}
            type="password"
            value={draft.passphrase}
          />
        </Field>
        {aliases.length > 0 && (
          <Field
            hint={`${draft.fileName || "The file"} holds more than one entry. Pick the one to import.`}
            label="Entry"
            required
          >
            <PickOne
              onChange={(alias) => onChange({ ...draft, alias })}
              options={aliases.map((a) => ({ label: a, value: a }))}
              placeholder="Pick an entry"
              value={draft.alias}
            />
          </Field>
        )}
      </div>
    </FormCard>
  );
};
