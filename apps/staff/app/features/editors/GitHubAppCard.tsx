import { Field, Input } from "@sneakers-web/ui";

import type { Policy } from "@/features/editors/policy";
import type { Problem, SecretType } from "@/features/editors/validate";

import { AppKeyInput } from "@/features/editors/AppKeyInput";
import { FieldControl } from "@/features/editors/FieldControl";
import { FormCard } from "@/features/editors/FormCard";

/** Where each of the App's details is found on GitHub. */
const DETAILS: { hint: string; key: string; mono?: boolean; placeholder: string }[] = [
  {
    hint: "On the App's settings page, under About.",
    key: "appId",
    mono: true,
    placeholder: "e.g. 1048576",
  },
  {
    hint: "On the same page, under About.",
    key: "clientId",
    mono: true,
    placeholder: "e.g. Iv23li…",
  },
  {
    hint: "The number at the end of the installation's settings address.",
    key: "installationId",
    mono: true,
    placeholder: "e.g. 52428800",
  },
  {
    hint: "The organization or account the App belongs to.",
    key: "ownerOrg",
    placeholder: "e.g. example-org",
  },
];

const SECRETS = ["clientSecret", "webhookSecret"];

/** The fields this card looks after, so the Fields card leaves them out. */
export const GITHUB_APP_KEYS = new Set([...DETAILS.map((d) => d.key), "privateKey", ...SECRETS]);

/**
 * U-05 GitHub App: its details with where to find each on GitHub, checked as they're typed,
 * and its private key from the .pem file GitHub downloads.
 */
export const GitHubAppCard = ({
  editing,
  live,
  onChange,
  policies,
  problems,
  type,
  values,
}: {
  editing: boolean;
  /** Every problem with the draft now, shown for a field as soon as it has a value. */
  live: Record<string, Problem>;
  onChange: (patch: Record<string, string>) => void;
  policies: Policy[];
  /** The problems shown for every field, after a save was tried. */
  problems: Record<string, Problem>;
  type: SecretType;
  values: Record<string, string>;
}) => {
  const definition = (key: string) => type.fields.find((f) => f.key === key);
  const shown = (key: string) =>
    (problems[key] ?? ((values[key] ?? "").trim() ? live[key] : undefined))?.message;
  const privateKey = definition("privateKey");
  return (
    <>
      <FormCard subtitle="From the App's settings page on GitHub." title="GitHub App">
        <div className="grid gap-x-4 gap-y-5 tablet:grid-cols-2">
          {DETAILS.map((d) => {
            const f = definition(d.key);
            if (!f) return null;
            return (
              <div id={`field-${f.key}`} key={f.key}>
                <Field error={shown(f.key)} hint={d.hint} label={f.label} required={!!f.required}>
                  <Input
                    autoComplete="off"
                    inputMode={f.pattern === String.raw`^\d+$` ? "numeric" : undefined}
                    mono={d.mono}
                    onChange={(event) => onChange({ [f.key]: event.target.value.trim() })}
                    placeholder={d.placeholder}
                    spellCheck={false}
                    value={values[f.key] ?? ""}
                  />
                </Field>
              </div>
            );
          })}
        </div>
      </FormCard>
      <FormCard
        subtitle="Stored encrypted. They're shown only through a recorded reveal."
        title="Credentials"
      >
        {privateKey && (
          <div id="field-privateKey">
            <AppKeyInput
              editing={editing}
              error={problems.privateKey?.message}
              label={privateKey.label}
              onChange={(v) => onChange({ privateKey: v })}
              value={values.privateKey ?? ""}
            />
          </div>
        )}
        <div className="grid gap-x-4 gap-y-5 tablet:grid-cols-2">
          {SECRETS.map((key) => {
            const f = definition(key);
            if (!f) return null;
            return (
              <div id={`field-${f.key}`} key={f.key}>
                <FieldControl
                  editing={editing}
                  field={f}
                  onChange={(v) => onChange({ [f.key]: v })}
                  policies={policies}
                  problem={problems[f.key]}
                  value={values[f.key] ?? ""}
                />
              </div>
            );
          })}
        </div>
      </FormCard>
    </>
  );
};
