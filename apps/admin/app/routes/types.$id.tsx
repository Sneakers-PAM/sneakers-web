import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import {
  AdminCreateSecretTypeDocument,
  AdminSecretTypeDocument,
  AdminUpdateSecretTypeDocument,
  type FieldKind,
  GraphQLRequestError,
  type PolicyEnforcement,
  type SecretFieldDefInput,
} from "@sneakers-web/api-client";
import { type Refusal, refusalMessage, refusalOf, useRootData } from "@sneakers-web/shell";
import { guard, requireUser } from "@sneakers-web/shell/server";
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  cn,
  Field,
  Input,
  Label,
  PageHeader,
  Segmented,
  Switch,
} from "@sneakers-web/ui";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Lock, Plus, X } from "lucide-react";
import { useState } from "react";
import {
  data,
  Form,
  Link,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
} from "react-router";

import { Choice, InfoButton, Panel, SettingRow } from "@/components/Admin";
import { PageError } from "@/components/PageError";
import { adminLoad } from "@/lib/admin.server";

export interface TypeDraft {
  checkout: boolean;
  fields: SecretFieldDefInput[];
  heartbeat: boolean;
  name: string;
  rotation: boolean;
}

const BLANK: TypeDraft = {
  checkout: false,
  fields: [],
  heartbeat: false,
  name: "",
  rotation: false,
};

export const loader = ({ params, request }: LoaderFunctionArgs) =>
  adminLoad(request, async (gw) => {
    const d = await gw.gql(AdminSecretTypeDocument);
    const policies = d.passwordPolicies.map((p) => ({
      label: `${p.name} (${p.minLength}–${p.maxLength || "any"})`,
      value: p.id,
    }));
    if (!params.id) return { draft: BLANK, origin: "custom" as const, policies, type: null };
    const t = d.secretTypes.find((x) => x.id === params.id);
    if (!t)
      throw new GraphQLRequestError([
        { extensions: { code: "NOT_FOUND" }, message: "type not found" },
      ]);
    const draft: TypeDraft = {
      checkout: !!t.checkout,
      fields: t.fields.map(
        (f) =>
          Object.fromEntries(
            Object.entries(f).filter(([, v]) => v !== null),
          ) as SecretFieldDefInput,
      ),
      heartbeat: !!t.heartbeat,
      name: t.name,
      rotation: !!t.rotation,
    };
    return { draft, origin: t.origin, policies, type: { id: t.id, vendor: t.vendor } };
  });

export const action = async ({ params, request }: ActionFunctionArgs) => {
  const { gw } = await requireUser(request);
  const form = await request.formData();
  const draft = JSON.parse(String(form.get("payload") ?? "{}")) as TypeDraft;
  return guard(request, async () => {
    try {
      await (params.id
        ? gw.gql(AdminUpdateSecretTypeDocument, { id: params.id, input: draft })
        : gw.gql(AdminCreateSecretTypeDocument, { input: draft }));
      throw redirect("/types");
    } catch (error) {
      const refusal = refusalOf(error);
      if (!refusal) throw error;
      return data<{ draft: TypeDraft; refusal: Refusal }>({ draft, refusal }, { status: 400 });
    }
  });
};

export const meta = ({ data: d }: { data?: Awaited<ReturnType<typeof loader>> }) => [
  { title: `${d?.draft.name || "New type"} · Sneakers-PAM admin console` },
];

const KINDS: { label: string; value: FieldKind }[] = [
  { label: "Text", value: "text" },
  { label: "Multi-line", value: "multiline" },
  { label: "Password", value: "password" },
  { label: "Sensitive (masked)", value: "sensitive" },
  { label: "Checkbox", value: "boolean" },
  { label: "Select", value: "select" },
  { label: "File", value: "file" },
];

const slug = (label: string) =>
  label
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "") || "field";

/** A key for a new field: its label as a slug, made unique among the type's fields. */
const keyFor = (label: string, taken: string[]) => {
  const base = slug(label);
  let key = base;
  for (let n = 2; taken.includes(key); n++) key = `${base}-${n}`;
  return key;
};

/** What stops the draft from saving, by field index ("name" for the type itself). */
export const draftProblems = (d: TypeDraft): Record<string, string> => {
  const out: Record<string, string> = {};
  if (!d.name.trim()) out.name = "Give the type a name.";
  for (const [index, f] of d.fields.entries()) {
    if (!f.label.trim()) out[index] = `Field ${index + 1} needs a label.`;
    else if (f.kind === "select" && (f.options ?? []).filter((o) => o.trim()).length === 0)
      out[index] = `Field ${index + 1} needs at least one option.`;
  }
  return out;
};

const IconButton = ({
  children,
  disabled,
  label,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) => (
  <Button
    aria-label={label}
    disabled={disabled}
    onClick={onClick}
    size="icon-sm"
    variant="secondary"
  >
    {children}
  </Button>
);

const FieldRow = ({
  count,
  field,
  index,
  onChange,
  onMove,
  onRemove,
  policies,
  problem,
  readOnly,
}: {
  count: number;
  field: SecretFieldDefInput;
  index: number;
  onChange: (patch: Partial<SecretFieldDefInput>) => void;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
  policies: { label: string; value: string }[];
  problem?: string;
  readOnly: boolean;
}) => {
  const [open, setOpen] = useState(field.kind === "select" || field.kind === "password");
  const [advanced, setAdvanced] = useState(
    !!field.pattern || !!field.maxLength || !!field.superSensitive,
  );
  const secret = field.kind === "password" || field.kind === "sensitive";
  const options = field.options ?? [];
  const n = index + 1;
  return (
    <li className={cn("rounded-lg border border-border", open && "border-primary")}>
      <fieldset
        className="m-0 flex flex-wrap items-center gap-3 border-0 px-4 py-3"
        disabled={readOnly}
      >
        <legend className="sr-only">Field {n}</legend>
        <span className="w-5 font-mono text-small text-muted">{n}</span>
        <button
          aria-expanded={open}
          aria-label={`${open ? "Hide" : "Show"} field ${n} settings`}
          className="text-muted"
          onClick={() => setOpen((v) => !v)}
          type="button"
        >
          {open ? (
            <ChevronDown aria-hidden className="size-4" />
          ) : (
            <ChevronRight aria-hidden className="size-4" />
          )}
        </button>
        <Input
          aria-invalid={problem ? true : undefined}
          aria-label={`Field ${n} label`}
          className="min-w-48 flex-1"
          onChange={(event) => onChange({ label: event.target.value })}
          placeholder="Label"
          value={field.label}
        />
        <div className="w-48">
          <Choice
            label={`Field ${n} kind`}
            onChange={(kind) => {
              onChange({ kind, ...(kind === "password" ? { sensitive: true } : {}) });
              if (kind === "select" || kind === "password") setOpen(true);
            }}
            options={KINDS}
            value={field.kind}
          />
        </div>
        <span className="flex items-center gap-2">
          <Checkbox
            checked={!!field.required}
            id={`f${index}-req`}
            onCheckedChange={(on) => onChange({ required: on === true })}
          />
          <Label htmlFor={`f${index}-req`}>Required</Label>
        </span>
        <span className="flex items-center gap-2">
          <Checkbox
            checked={field.kind === "password" || !!field.sensitive}
            disabled={field.kind === "password"}
            id={`f${index}-sens`}
            onCheckedChange={(on) => onChange({ sensitive: on === true })}
          />
          <Label htmlFor={`f${index}-sens`}>Sensitive</Label>
        </span>
        {!readOnly && (
          <span className="ml-auto flex gap-1.5">
            <IconButton
              disabled={index === 0}
              label={`Move field ${n} up`}
              onClick={() => onMove(-1)}
            >
              <ArrowUp aria-hidden />
            </IconButton>
            <IconButton
              disabled={index === count - 1}
              label={`Move field ${n} down`}
              onClick={() => onMove(1)}
            >
              <ArrowDown aria-hidden />
            </IconButton>
            <Button
              aria-label={`Remove field ${n}`}
              className="text-danger"
              onClick={onRemove}
              size="icon-sm"
              variant="ghost"
            >
              <X aria-hidden />
            </Button>
          </span>
        )}
      </fieldset>
      {open && (
        <fieldset
          className="m-0 flex flex-col gap-4 border-0 border-t border-border bg-sunken/50 px-4 py-4 pl-16"
          disabled={readOnly}
        >
          <legend className="sr-only">Field {n} settings</legend>
          {field.kind === "select" && (
            <div className="flex flex-col gap-2">
              <b className="text-[0.875rem]">Options</b>
              <ol className="m-0 flex list-none flex-col gap-2 p-0">
                {options.map((o, oi) => (
                  <li className="flex items-center gap-2" key={oi}>
                    <span className="w-5 font-mono text-small text-muted">{oi + 1}</span>
                    <Input
                      aria-label={`Field ${n} option ${oi + 1}`}
                      className="max-w-72"
                      onChange={(event) =>
                        onChange({
                          options: options.map((x, xi) => (xi === oi ? event.target.value : x)),
                        })
                      }
                      value={o}
                    />
                    {!readOnly && (
                      <>
                        <IconButton
                          disabled={oi === 0}
                          label={`Move option ${oi + 1} up`}
                          onClick={() => onChange({ options: swap(options, oi, oi - 1) })}
                        >
                          <ArrowUp aria-hidden />
                        </IconButton>
                        <IconButton
                          disabled={oi === options.length - 1}
                          label={`Move option ${oi + 1} down`}
                          onClick={() => onChange({ options: swap(options, oi, oi + 1) })}
                        >
                          <ArrowDown aria-hidden />
                        </IconButton>
                      </>
                    )}
                    {field.defaultValue === o && o ? (
                      <Badge tone="primary">Default</Badge>
                    ) : (
                      !readOnly && (
                        <button
                          className="text-small font-bold text-primary hover:text-ink"
                          onClick={() => onChange({ defaultValue: o })}
                          type="button"
                        >
                          Make default
                        </button>
                      )
                    )}
                  </li>
                ))}
              </ol>
              {!readOnly && (
                <button
                  className="self-start text-small font-bold text-primary hover:text-ink"
                  onClick={() => onChange({ options: [...options, ""] })}
                  type="button"
                >
                  + Add option
                </button>
              )}
            </div>
          )}
          {field.kind === "password" && (
            <div className="grid gap-4 tablet:grid-cols-2">
              <Field label="Password policy">
                <Choice
                  onChange={(policyId) =>
                    onChange({ policyId: policyId === "default" ? undefined : policyId })
                  }
                  options={[{ label: "The default policy", value: "default" }, ...policies]}
                  value={field.policyId ?? "default"}
                />
              </Field>
              <div className="flex flex-col gap-2">
                <span className="text-[0.875rem] font-bold">Enforcement</span>
                <Segmented<PolicyEnforcement>
                  label={`Field ${n} enforcement`}
                  onChange={(policyEnforcement) => onChange({ policyEnforcement })}
                  options={[
                    { label: "Lax", value: "lax" },
                    { label: "Strict", value: "strict" },
                  ]}
                  value={field.policyEnforcement ?? "lax"}
                />
                <span className="text-small text-muted">
                  Strict: a typed password must pass the policy. Lax: the policy only drives the
                  generator.
                </span>
              </div>
            </div>
          )}
          <button
            aria-expanded={advanced}
            className="self-start text-small font-bold text-primary hover:text-ink"
            onClick={() => setAdvanced((v) => !v)}
            type="button"
          >
            {advanced ? "▾" : "▸"} Advanced
          </button>
          {advanced && (
            <div className="grid items-end gap-4 tablet:grid-cols-4">
              <Field hint="A regular expression the value must match." label="Validation pattern">
                <Input
                  mono
                  onChange={(event) => onChange({ pattern: event.target.value || undefined })}
                  placeholder="regex, optional"
                  value={field.pattern ?? ""}
                />
              </Field>
              <Field label="Max length">
                <Input
                  min={0}
                  mono
                  onChange={(event) =>
                    onChange({ maxLength: Number(event.target.value) || undefined })
                  }
                  type="number"
                  value={field.maxLength ?? ""}
                />
              </Field>
              {secret && (
                <>
                  <span className="flex items-center gap-2 pb-3">
                    <Checkbox
                      checked={!!field.superSensitive}
                      id={`f${index}-super`}
                      onCheckedChange={(on) => onChange({ superSensitive: on === true })}
                    />
                    <Label htmlFor={`f${index}-super`}>Highly sensitive</Label>
                  </span>
                  <span className="flex items-center gap-2 pb-3">
                    <Checkbox
                      checked={!!field.rotates}
                      id={`f${index}-rot`}
                      onCheckedChange={(on) => onChange({ rotates: on === true })}
                    />
                    <Label htmlFor={`f${index}-rot`}>Rotates</Label>
                  </span>
                </>
              )}
            </div>
          )}
        </fieldset>
      )}
      {problem && (
        <p
          className="m-0 flex items-center gap-1 px-4 pb-3 pl-16 text-small font-bold text-danger"
          role="alert"
        >
          <X aria-hidden className="size-3.5" strokeWidth={3} />
          {problem}
        </p>
      )}
    </li>
  );
};

const swap = <T,>(list: T[], a: number, b: number): T[] => {
  if (b < 0 || b >= list.length) return list;
  const next = [...list];
  [next[a], next[b]] = [next[b] as T, next[a] as T];
  return next;
};

const TypeEditor = () => {
  const { draft: saved, origin, policies, type } = useLoaderData<typeof loader>();
  const { config } = useRootData();
  const result = useActionData<typeof action>();
  const busy = useNavigation().state === "submitting";
  const [d, setD] = useState<TypeDraft>(result?.draft ?? saved);
  const [tried, setTried] = useState(false);
  const readOnly = origin !== "custom";
  const problems = draftProblems(d);
  const show = tried || !!result;
  const patch = (index: number, p: Partial<SecretFieldDefInput>) =>
    setD((current) => ({
      ...current,
      fields: current.fields.map((f, index_) => (index_ === index ? { ...f, ...p } : f)),
    }));

  const source =
    origin === "system"
      ? "Built-in type, read-only"
      : origin === "extension"
        ? `Extension · ${type?.vendor ?? "pack"}, read-only`
        : type
          ? "Custom type"
          : "A new custom type";

  return (
    <Form
      className="flex flex-col gap-6"
      method="post"
      onSubmit={(event) => {
        setTried(true);
        if (Object.keys(problems).length > 0) event.preventDefault();
      }}
    >
      <input name="payload" type="hidden" value={JSON.stringify({ ...d, name: d.name.trim() })} />
      <PageHeader
        actions={
          readOnly ? (
            <Button asChild variant="secondary">
              <Link to="/types">Back to types</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="secondary">
                <Link to="/types">Cancel</Link>
              </Button>
              <Button loading={busy} loadingLabel="Saving…" type="submit">
                Save type
              </Button>
            </>
          )
        }
        eyebrow="Configuration · Types"
        subtitle={source}
        title={
          <span className="flex items-center gap-3">
            {d.name.trim() || "New type"}
            {readOnly && <Lock aria-label="Read-only" className="size-6 text-muted" />}
          </span>
        }
      />
      {readOnly && (
        <Alert tone="info">
          Built-in and extension types can&apos;t be changed. Clone it from the types list to make
          an editable copy.
        </Alert>
      )}
      {result?.refusal && (
        <Alert title="Couldn't save the type" tone="danger">
          {refusalMessage(result.refusal)}
        </Alert>
      )}
      <Panel title="Details">
        <Field
          className="max-w-[32.5rem]"
          error={show ? problems.name : undefined}
          label="Type name"
          required
        >
          <Input
            disabled={readOnly}
            onChange={(event) => setD({ ...d, name: event.target.value })}
            value={d.name}
          />
        </Field>
        <div className="flex flex-col gap-4 border-t border-border pt-4">
          <SettingRow
            body="Checks the value against a target on a schedule."
            control={
              <Switch
                aria-labelledby="t-hb"
                checked={d.heartbeat}
                disabled={readOnly}
                onCheckedChange={(heartbeat) => setD({ ...d, heartbeat })}
              />
            }
            id="t-hb"
            title="Supports heartbeat (remote validation)"
          />
          <SettingRow
            body="Lets the fields marked Rotates be changed on the target, on a schedule or on demand."
            control={
              <Switch
                aria-labelledby="t-rot"
                checked={d.rotation}
                disabled={readOnly}
                onCheckedChange={(rotation) => setD({ ...d, rotation })}
              />
            }
            id="t-rot"
            title="Allows rotation"
          />
          <SettingRow
            body="Users must check it out to reveal; check-in rotates it."
            control={
              <Switch
                aria-labelledby="t-co"
                checked={d.checkout}
                disabled={readOnly}
                onCheckedChange={(checkout) => setD({ ...d, checkout })}
              />
            }
            id="t-co"
            title={
              <span className="inline-flex items-center gap-1.5">
                Requires checkout (privileged, rotate-on-checkin)
                <InfoButton label="What checkout means for an MCP agent">
                  <p className="m-0">
                    An MCP agent must check this secret out before it can reveal its value, the same
                    as checking it out here. Checking it back in rotates the value, so the next
                    checkout gets a fresh one.
                  </p>
                  <a
                    className="font-bold text-primary"
                    href={`${config.staffUrl.replace(/\/$/, "")}/agents#how-approvals-work`}
                  >
                    How approvals work
                  </a>
                </InfoButton>
              </span>
            }
          />
        </div>
      </Panel>
      <Panel title="Fields">
        <span className="-mt-2 text-small text-muted">
          The order here is the order on the secret page.
        </span>
        {d.fields.length === 0 && (
          <p className="m-0 text-small text-muted">No fields yet. Add the first one.</p>
        )}
        <ol className="m-0 flex list-none flex-col gap-3 p-0">
          {d.fields.map((f, index) => (
            <FieldRow
              count={d.fields.length}
              field={f}
              index={index}
              key={f.key}
              onChange={(p) => patch(index, p)}
              onMove={(by) =>
                setD((current) => ({ ...current, fields: swap(current.fields, index, index + by) }))
              }
              onRemove={() =>
                setD((current) => ({
                  ...current,
                  fields: current.fields.filter((_, index_) => index_ !== index),
                }))
              }
              policies={policies}
              problem={show ? problems[index] : undefined}
              readOnly={readOnly}
            />
          ))}
        </ol>
        {!readOnly && (
          <Button
            className="self-start"
            onClick={() =>
              setD((current) => ({
                ...current,
                fields: [
                  ...current.fields,
                  {
                    key: keyFor(
                      `field ${current.fields.length + 1}`,
                      current.fields.map((f) => f.key),
                    ),
                    kind: "text",
                    label: "",
                  },
                ],
              }))
            }
            size="sm"
            variant="ghost"
          >
            <Plus aria-hidden />
            Add field
          </Button>
        )}
      </Panel>
    </Form>
  );
};

export default TypeEditor;

export const ErrorBoundary = () => <PageError back="/types" backLabel="Back to types" />;
