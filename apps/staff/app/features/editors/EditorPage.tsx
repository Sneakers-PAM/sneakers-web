import { refusalMessage } from "@sneakers-web/shell";
import { Alert, Button, cn, Field, Input, PageHeader, plural } from "@sneakers-web/ui";
import { Plus } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Link, useFetcher } from "react-router";

import type { EditorActionResult, EditorData, Target } from "@/features/editors/editors.server";

import {
  CertificateCard,
  type CertificateDraft,
  EMPTY_CERTIFICATE,
} from "@/features/editors/CertificateCard";
import { FieldControl, isWide } from "@/features/editors/FieldControl";
import { FormCard } from "@/features/editors/FormCard";
import { KeyPairCard, keyPairKeys } from "@/features/editors/KeyPairCard";
import { NewTargetDialog } from "@/features/editors/NewTargetDialog";
import { PickOne } from "@/features/editors/PickOne";
import { generatePassword, policyFor } from "@/features/editors/policy";
import { TypePicker } from "@/features/editors/TypePicker";
import {
  formProblems,
  isCertificateType,
  isKeyPairType,
  problemCount,
  type Problems,
  problemSummaries,
  type SecretType,
} from "@/features/editors/validate";

const NO_TARGET = "none";
const NO_PROBLEMS: Problems = { basics: {}, fields: {} };

/** The values a new secret of `type` starts with: choices on their default, passwords made. */
const seed = (type: SecretType, policies: EditorData["policies"]) => {
  const out: Record<string, string> = {};
  for (const f of type.fields) {
    switch (f.kind) {
      case "boolean": {
        out[f.key] = f.defaultValue ?? "false";
        break;
      }
      case "password": {
        out[f.key] = generatePassword(policyFor(f, policies));
        break;
      }
      case "select": {
        out[f.key] = f.defaultValue ?? f.options?.[0] ?? "";
        break;
      }
      default: {
        out[f.key] = f.defaultValue ?? "";
      }
    }
  }
  return out;
};

/** Types that work against a host, so picking a target means something. */
const usesTarget = (t: SecretType) => !!t.heartbeat || !!t.rotation || isKeyPairType(t);

/** U-05: the new and edit secret form, built from the chosen type's field definitions. */
export const EditorPage = ({ page }: { page: EditorData }) => {
  const editing = page.mode === "edit";
  const saver = useFetcher<EditorActionResult>({ key: "editor-save" });
  const [name, setName] = useState(page.draft.name);
  const [folderId, setFolderId] = useState(page.draft.folderId);
  const [typeId, setTypeId] = useState(page.draft.typeId);
  const [targetId, setTargetId] = useState(page.draft.targetId);
  const [expires, setExpires] = useState(page.draft.expires);
  const [values, setValues] = useState<Record<string, string>>(page.draft.values);
  const [certificate, setCertificate] = useState<CertificateDraft>(EMPTY_CERTIFICATE);
  const [targets, setTargets] = useState<Target[]>(page.targets);
  const [targetOpen, setTargetOpen] = useState(false);
  const [attempted, setAttempted] = useState(false);

  const type = page.types.find((t) => t.id === typeId);
  const certCreate = !editing && !!type && isCertificateType(type);
  const keyPair = !!type && isKeyPairType(type);
  const folder = page.folders.find((f) => f.id === folderId);

  const live = useMemo(
    () => formProblems({ folderId, name, typeId, values }, type, page.policies, { editing }),
    [folderId, name, typeId, values, type, page.policies, editing],
  );
  const result = saver.state === "idle" ? saver.data : undefined;
  const server = result && !result.ok ? result : undefined;
  const problems = attempted ? live : (server?.problems ?? NO_PROBLEMS);
  const count = problemCount(problems);
  const aliases = result?.ok && result.intent === "import-cert" ? result.aliases : [];
  const certError =
    attempted && certCreate && !certificate.fileBase64 ? "Choose a certificate file." : undefined;

  const setField = useCallback(
    (patch: Record<string, string>) => setValues((v) => ({ ...v, ...patch })),
    [],
  );

  const chooseType = (id: string) => {
    setTypeId(id);
    const t = page.types.find((x) => x.id === id);
    if (t) setValues(seed(t, page.policies));
    setAttempted(false);
  };

  const created = useCallback((t: Target) => {
    setTargets((list) => [...list.filter((x) => x.id !== t.id), t]);
    setTargetId(t.id);
    setTargetOpen(false);
  }, []);

  const submit = () => {
    setAttempted(true);
    if (problemCount(live) > 0) return;
    if (certCreate) {
      if (!certificate.fileBase64) return;
      void saver.submit(
        {
          alias: certificate.alias,
          fileBase64: certificate.fileBase64,
          folderId,
          intent: "import-cert",
          name,
          passphrase: certificate.passphrase,
        },
        { method: "post" },
      );
      setAttempted(false);
      return;
    }
    const form: Record<string, string> = {
      expires,
      folderId,
      intent: "save",
      name,
      targetId,
      typeId,
    };
    for (const f of type?.fields ?? []) form[`f:${f.key}`] = values[f.key] ?? "";
    void saver.submit(form, { method: "post" });
    setAttempted(false);
  };

  const hidden = type && keyPair ? keyPairKeys(type) : new Set<string>();
  const shownFields = type?.fields.filter((f) => !hidden.has(f.key)) ?? [];
  const cancelTo = editing
    ? `/secret/${page.secretId}`
    : folderId
      ? `/browse/${folderId}`
      : "/browse";
  const busy = saver.state !== "idle";
  const title = editing ? `Edit ${page.draft.name}` : "New secret";
  const action = certCreate ? "Import certificate" : editing ? "Save changes" : "Create secret";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        actions={
          <>
            <Button asChild variant="secondary">
              <Link to={cancelTo}>Cancel</Link>
            </Button>
            <Button
              disabled={attempted && count > 0}
              loading={busy}
              loadingLabel={editing ? "Saving…" : "Creating…"}
              onClick={submit}
            >
              {action}
            </Button>
          </>
        }
        eyebrow={folder ? `Secret · ${folder.path}` : "Secret"}
        title={title}
      />

      {count > 0 && (
        <section aria-label="Fields that need attention">
          <Alert
            role="alert"
            title={
              count === 1 ? "1 field needs attention" : `${plural(count, "field")} need attention`
            }
            tone="danger"
          >
            {problemSummaries(problems).join(" · ")}.
          </Alert>
        </section>
      )}
      {server?.refusal && (
        <Alert
          role="alert"
          title={editing ? "Couldn't save the secret" : "Couldn't create the secret"}
          tone="danger"
        >
          {refusalMessage(server.refusal)}
        </Alert>
      )}

      <FormCard title="Basics">
        <div className="grid gap-x-4 gap-y-5 tablet:grid-cols-2">
          <Field error={problems.basics.name?.message} label="Name" required>
            <Input
              autoComplete="off"
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. web-01 deploy key"
              value={name}
            />
          </Field>
          <Field
            error={problems.basics.folderId?.message}
            hint={editing ? "Move it from Browse." : undefined}
            label="Folder"
            required={!editing}
          >
            <PickOne
              disabled={editing}
              onChange={setFolderId}
              options={page.folders.map((f) => ({ label: f.path, value: f.id }))}
              placeholder="Pick a folder"
              value={folderId}
            />
          </Field>
          <Field error={problems.basics.typeId?.message} label="Type" required>
            <TypePicker
              disabled={editing}
              onChange={chooseType}
              types={page.types}
              value={typeId}
            />
          </Field>
          {type && usesTarget(type) && (
            <div className="flex items-end gap-2">
              <Field className="min-w-0 flex-1" label="Target">
                <PickOne
                  onChange={(v) => setTargetId(v === NO_TARGET ? "" : v)}
                  options={[
                    { label: "No target", value: NO_TARGET },
                    ...targets.map((t) => ({ label: `${t.name} · ${t.hostname}`, value: t.id })),
                  ]}
                  value={targetId || NO_TARGET}
                />
              </Field>
              <Button onClick={() => setTargetOpen(true)} type="button" variant="secondary">
                <Plus aria-hidden />
                New target
              </Button>
            </div>
          )}
          {!certCreate && (
            <Field
              hint="Sneakers reminds you before then; it never turns the secret off."
              label={
                <>
                  Expires <span className="font-normal text-muted">(optional)</span>
                </>
              }
            >
              <Input
                className="font-mono"
                onChange={(event) => setExpires(event.target.value)}
                type="date"
                value={expires}
              />
            </Field>
          )}
        </div>
      </FormCard>

      {certCreate && (
        <CertificateCard
          aliases={aliases}
          draft={certificate}
          error={certError}
          onChange={setCertificate}
        />
      )}

      {editing && type && isCertificateType(type) && (
        <FormCard title="Certificate">
          <p className="m-0 text-body text-muted">
            The certificate and its key are set on import. To rotate them in place, use Replace
            certificate on the secret&apos;s page.
          </p>
        </FormCard>
      )}

      {type && keyPair && (
        <KeyPairCard
          editing={editing}
          onChange={setField}
          problems={problems.fields}
          type={type}
          values={values}
        />
      )}

      {type && !isCertificateType(type) && shownFields.length > 0 && (
        <FormCard
          subtitle={`From the ${type.name} type. Required fields are marked.`}
          title="Fields"
        >
          <div className="grid gap-x-4 gap-y-5 tablet:grid-cols-2">
            {shownFields.map((f) => (
              <div className={cn(isWide(f) && "tablet:col-span-2")} key={f.key}>
                <FieldControl
                  editing={editing}
                  field={f}
                  onChange={(v) => setField({ [f.key]: v })}
                  policies={page.policies}
                  problem={problems.fields[f.key]}
                  value={values[f.key] ?? ""}
                />
              </div>
            ))}
          </div>
        </FormCard>
      )}

      <NewTargetDialog
        connections={page.connections}
        onClose={() => setTargetOpen(false)}
        onCreated={created}
        open={targetOpen}
      />
    </div>
  );
};
