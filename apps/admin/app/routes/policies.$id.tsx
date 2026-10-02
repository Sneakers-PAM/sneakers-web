import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import {
  AdminDeletePasswordPolicyDocument,
  AdminPoliciesDocument,
  AdminSavePasswordPolicyDocument,
  GraphQLRequestError,
  type PwStartClass,
} from "@sneakers-web/api-client";
import { type Refusal, refusalMessage, refusalOf } from "@sneakers-web/shell";
import { guard, requireUser } from "@sneakers-web/shell/server";
import {
  Alert,
  Button,
  Checkbox,
  Field,
  Input,
  Label,
  PageHeader,
  plural,
  useIsClient,
} from "@sneakers-web/ui";
import { RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import {
  data,
  Form,
  Link,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
} from "react-router";

import { Choice, Panel } from "@/components/Admin";
import { PageError } from "@/components/PageError";
import { adminLoad, text } from "@/lib/admin.server";
import { examplePassword, policyProblems, type PolicyRules } from "@/lib/policy";

const BLANK: PolicyRules = {
  endLiteral: "",
  excludeChars: "",
  maxLength: 64,
  minLength: 14,
  name: "",
  requireDigit: true,
  requireLower: true,
  requireSymbol: true,
  requireUpper: true,
  rotationDays: 0,
  startClass: "any",
};

export const loader = ({ params, request }: LoaderFunctionArgs) =>
  adminLoad(request, async (gw) => {
    if (!params.id) return { policy: null, rules: BLANK };
    const { passwordPolicies } = await gw.gql(AdminPoliciesDocument);
    const p = passwordPolicies.find((x) => x.id === params.id);
    if (!p)
      throw new GraphQLRequestError([
        { extensions: { code: "NOT_FOUND" }, message: "policy not found" },
      ]);
    const rules: PolicyRules = {
      endLiteral: p.endLiteral ?? "",
      excludeChars: p.excludeChars ?? "",
      maxLength: p.maxLength ?? 0,
      minLength: p.minLength,
      name: p.name,
      requireDigit: p.requireDigit,
      requireLower: p.requireLower,
      requireSymbol: p.requireSymbol,
      requireUpper: p.requireUpper,
      rotationDays: p.rotationDays ?? 0,
      startClass: p.startClass ?? "any",
    };
    return {
      policy: {
        byTypeFields: p.byTypeFields,
        deletable: p.deletable,
        id: p.id,
        isDefault: p.isDefault,
      },
      rules,
    };
  });

const rulesFrom = (form: FormData): PolicyRules => ({
  endLiteral: String(form.get("endLiteral") ?? ""),
  excludeChars: String(form.get("excludeChars") ?? ""),
  maxLength: Number(text(form, "maxLength") || 0),
  minLength: Number(text(form, "minLength") || 0),
  name: text(form, "name"),
  requireDigit: form.has("requireDigit"),
  requireLower: form.has("requireLower"),
  requireSymbol: form.has("requireSymbol"),
  requireUpper: form.has("requireUpper"),
  rotationDays: Number(text(form, "rotationDays") || 0),
  startClass: (text(form, "startClass") || "any") as PwStartClass,
});

export const action = async ({ params, request }: ActionFunctionArgs) => {
  const { gw } = await requireUser(request);
  const form = await request.formData();
  const rules = rulesFrom(form);
  return guard(request, async () => {
    try {
      if (text(form, "intent") === "delete" && params.id) {
        await gw.gql(AdminDeletePasswordPolicyDocument, { id: params.id });
        throw redirect("/policies");
      }
      if (Object.keys(policyProblems(rules)).length > 0)
        return data<{ refusal?: Refusal; rules: PolicyRules }>({ rules }, { status: 400 });
      await gw.gql(AdminSavePasswordPolicyDocument, {
        input: {
          ...rules,
          endLiteral: rules.endLiteral || null,
          excludeChars: rules.excludeChars || null,
          id: params.id ?? null,
          maxLength: rules.maxLength || null,
          rotationDays: rules.rotationDays || null,
        },
      });
      throw redirect("/policies");
    } catch (error) {
      const refusal = refusalOf(error);
      if (!refusal) throw error;
      return data<{ refusal?: Refusal; rules: PolicyRules }>({ refusal, rules }, { status: 400 });
    }
  });
};

export const meta = ({ data: d }: { data?: Awaited<ReturnType<typeof loader>> }) => [
  { title: `${d?.rules.name || "New policy"} · Sneakers-PAM admin console` },
];

const START: { label: string; value: PwStartClass }[] = [
  { label: "Anything", value: "any" },
  { label: "A letter", value: "letter" },
  { label: "A digit", value: "digit" },
  { label: "A symbol", value: "symbol" },
];

const CLASSES = [
  ["requireUpper", "Uppercase"],
  ["requireLower", "Lowercase"],
  ["requireDigit", "Digit"],
  ["requireSymbol", "Symbol"],
] as const;

const PolicyEditor = () => {
  const { policy, rules: saved } = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const busy = useNavigation().state === "submitting";
  const [r, setR] = useState<PolicyRules>(result?.rules ?? saved);
  const [seed, setSeed] = useState(0);
  const set = <K extends keyof PolicyRules>(key: K, value: PolicyRules[K]) =>
    setR((current) => ({ ...current, [key]: value }));
  const problems = policyProblems(r);
  const touchedName = r.name !== saved.name || !!result;
  const client = useIsClient();
  // The example is random, so it's made in the browser only (the server render would differ).
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `seed` asks for a fresh example
  const example = useMemo(() => (client ? examplePassword(r) : null), [client, r, seed]);
  const blocking = Object.entries(problems).filter(([k]) => k !== "name");

  return (
    <Form className="flex flex-col gap-6" method="post">
      <PageHeader
        actions={
          <>
            {policy && (
              <Button
                className={policy.deletable ? "border-danger text-danger" : undefined}
                disabled={!policy.deletable}
                name="intent"
                title={
                  policy.deletable
                    ? undefined
                    : policy.isDefault
                      ? "It's the default policy."
                      : `Used by ${plural(policy.byTypeFields, "type field")}.`
                }
                type="submit"
                value="delete"
                variant="secondary"
              >
                Delete
              </Button>
            )}
            <Button asChild variant="secondary">
              <Link to="/policies">Cancel</Link>
            </Button>
            <Button
              disabled={Object.keys(problems).length > 0}
              loading={busy}
              loadingLabel="Saving…"
              name="intent"
              type="submit"
              value="save"
            >
              Save policy
            </Button>
          </>
        }
        eyebrow="Configuration · Policies"
        subtitle={
          policy
            ? `${policy.isDefault ? "Default policy" : "Policy"} · used by ${plural(policy.byTypeFields, "type field")}`
            : "A new policy for generating and checking passwords."
        }
        title={r.name.trim() || "New policy"}
      />
      {result?.refusal && (
        <Alert title="Couldn't save the policy" tone="danger">
          {refusalMessage(result.refusal)}
        </Alert>
      )}
      <div className="grid items-start gap-5 desktop:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Panel title="Rules">
          <div className="grid gap-4 tablet:grid-cols-3">
            <Field error={touchedName ? problems.name : undefined} label="Name" required>
              <Input
                name="name"
                onChange={(event) => set("name", event.target.value)}
                value={r.name}
              />
            </Field>
            <Field error={problems.minLength} label="Min length">
              <Input
                min={1}
                mono
                name="minLength"
                onChange={(event) => set("minLength", Number(event.target.value))}
                type="number"
                value={r.minLength}
              />
            </Field>
            <Field error={problems.maxLength} hint="0 means no cap." label="Max length">
              <Input
                min={0}
                mono
                name="maxLength"
                onChange={(event) => set("maxLength", Number(event.target.value))}
                type="number"
                value={r.maxLength}
              />
            </Field>
          </div>
          <Field className="max-w-[12.5rem]" hint="0 means never." label="Rotate every (days)">
            <Input
              min={0}
              mono
              name="rotationDays"
              onChange={(event) => set("rotationDays", Number(event.target.value))}
              type="number"
              value={r.rotationDays}
            />
          </Field>
          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="mb-2 text-[0.875rem] font-bold">Must include</legend>
            <div className="flex flex-wrap gap-5">
              {CLASSES.map(([key, label]) => (
                <span className="flex items-center gap-2" key={key}>
                  <Checkbox
                    checked={r[key]}
                    id={`pol-${key}`}
                    name={key}
                    onCheckedChange={(on) => set(key, on === true)}
                  />
                  <Label htmlFor={`pol-${key}`}>{label}</Label>
                </span>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-4 tablet:grid-cols-3">
            <Field label="Must start with">
              <Choice
                name="startClass"
                onChange={(v) => set("startClass", v)}
                options={START}
                value={r.startClass}
              />
            </Field>
            <Field label="Must end with">
              <Input
                mono
                name="endLiteral"
                onChange={(event) => set("endLiteral", event.target.value)}
                placeholder="anything"
                value={r.endLiteral}
              />
            </Field>
            <Field error={problems.excludeChars} label="Disallowed characters">
              <Input
                mono
                name="excludeChars"
                onChange={(event) => set("excludeChars", event.target.value)}
                value={r.excludeChars}
              />
            </Field>
          </div>
        </Panel>
        <Panel title="Live example">
          <output
            aria-label="Example password"
            className="flex h-14 items-center overflow-x-auto rounded-md border-[1.5px] border-dashed border-border-strong bg-sunken px-4 font-mono text-[1.375rem] font-medium tracking-[0.04em] text-muted"
          >
            {example ?? "—"}
          </output>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              disabled={!example}
              onClick={() => setSeed((s) => s + 1)}
              size="sm"
              variant="secondary"
            >
              <RefreshCw aria-hidden />
              Regenerate
            </Button>
            <span className="text-small text-muted">
              Uses the rules as edited, before you save.
            </span>
          </div>
          {blocking.length > 0 && (
            <Alert title="Paused: these rules are impossible" tone="warn">
              {blocking.map(([, message]) => message).join(" ")}
            </Alert>
          )}
        </Panel>
      </div>
    </Form>
  );
};

export default PolicyEditor;

export const ErrorBoundary = () => <PageError back="/policies" backLabel="Back to policies" />;
