import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import {
  AdminDeletePasswordPolicyDocument,
  AdminPoliciesDocument,
  AdminUpdateSecuritySettingsDocument,
  type SecuritySettingsInput,
} from "@sneakers-web/api-client";
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  Pill,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  Tooltip,
} from "@sneakers-web/ui";
import { Plus } from "lucide-react";
import { useState } from "react";
import { Link, useFetcher, useLoaderData } from "react-router";

import { Choice, Panel, SettingRow, useResultToast } from "@/components/Admin";
import { PageError } from "@/components/PageError";
import { adminAct, adminLoad, text } from "@/lib/admin.server";
import { classChips } from "@/lib/policy";

export const loader = ({ request }: LoaderFunctionArgs) =>
  adminLoad(request, async (gw) => {
    const d = await gw.gql(AdminPoliciesDocument);
    return {
      policies: d.passwordPolicies.toSorted((a, b) => a.name.localeCompare(b.name)),
      security: d.securitySettings,
    };
  });

const SWITCHES = {
  allowApiForSensitive: "API access to sensitive secrets",
  requireMfaForReveal: "MFA before a reveal",
  requireMfaForSensitiveCheckout: "MFA for sensitive checkout",
} as const;

export const action = async ({ request }: ActionFunctionArgs) => {
  const form = await request.formData();
  const intent = text(form, "intent");
  return adminAct(request, intent, async (gw) => {
    if (intent === "delete-policy") {
      await gw.gql(AdminDeletePasswordPolicyDocument, { id: text(form, "id") });
      return `Deleted ${text(form, "name")}.`;
    }
    const input: SecuritySettingsInput = {};
    let note = "Saved.";
    if (intent === "switch") {
      const key = text(form, "key") as keyof typeof SWITCHES;
      if (!(key in SWITCHES)) throw new Error("unknown setting");
      input[key] = text(form, "on") === "true";
      note = `Saved · ${SWITCHES[key]} ${input[key] ? "on" : "off"}.`;
    }
    if (intent === "default-policy") {
      input.defaultPasswordPolicyId = text(form, "policyId");
      note = "Saved · default policy.";
    }
    if (intent === "limits") {
      input.requestHistoryRetentionDays = Number(text(form, "retention"));
      input.sessionTtlSeconds = Number(text(form, "sessionMinutes")) * 60;
      note = "Saved · retention and session timeout.";
    }
    await gw.gql(AdminUpdateSecuritySettingsDocument, { input });
    return note;
  });
};

export const meta = () => [{ title: "Password policies · Sneakers-PAM admin console" }];

const Policies = () => {
  const { policies, security } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  useResultToast(fetcher.data);
  const limits = useFetcher<typeof action>();
  useResultToast(limits.data);
  const flip = (key: keyof typeof SWITCHES, on: boolean) =>
    void fetcher.submit({ intent: "switch", key, on: String(on) }, { method: "post" });
  const [minutes, setMinutes] = useState(
    String(Math.round((security.sessionTtlSeconds ?? 1800) / 60)),
  );
  const asNumber = Number(minutes);
  const minutesProblem =
    !Number.isInteger(asNumber) || asNumber < 15
      ? "At least 15."
      : asNumber > 60
        ? "Max is 60."
        : undefined;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        actions={
          <Button asChild>
            <Link to="/policies/new">
              <Plus aria-hidden />
              New policy
            </Link>
          </Button>
        }
        eyebrow="Configuration · Policies"
        subtitle="Rules for generating and checking passwords."
        title="Password policies"
      />
      <div className="flex flex-col gap-2">
        <Card>
          <Table>
            <TableHead>
              <tr>
                <TableHeaderCell>Name</TableHeaderCell>
                <TableHeaderCell>Length</TableHeaderCell>
                <TableHeaderCell>Complexity</TableHeaderCell>
                <TableHeaderCell>Rotation</TableHeaderCell>
                <TableHeaderCell>In use</TableHeaderCell>
                <TableHeaderCell>
                  <span className="sr-only">Actions</span>
                </TableHeaderCell>
              </tr>
            </TableHead>
            <TableBody>
              {policies.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <span className="flex items-center gap-2 font-bold">
                      {p.name}
                      {p.isDefault && <Badge tone="primary">Default</Badge>}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono">
                    {p.minLength}–{p.maxLength || "any"}
                  </TableCell>
                  <TableCell>
                    <span className="flex flex-wrap gap-1">
                      {classChips(p).map((c) => (
                        <span
                          className="rounded-xs border-[1.5px] border-ink px-1.5 py-0.5 font-mono text-[0.75rem] font-bold"
                          key={c}
                        >
                          {c}
                        </span>
                      ))}
                      {classChips(p).length === 0 && <span className="text-muted">Any</span>}
                    </span>
                  </TableCell>
                  <TableCell>{p.rotationDays ? `Every ${p.rotationDays} days` : "Never"}</TableCell>
                  <TableCell className="font-mono">{p.byTypeFields}</TableCell>
                  <TableCell>
                    <span className="flex justify-end gap-2">
                      <Button asChild size="sm" variant="secondary">
                        <Link aria-label={`Edit ${p.name}`} to={`/policies/${p.id}`}>
                          Edit
                        </Link>
                      </Button>
                      {p.deletable ? (
                        <fetcher.Form method="post">
                          <input name="intent" type="hidden" value="delete-policy" />
                          <input name="id" type="hidden" value={p.id} />
                          <input name="name" type="hidden" value={p.name} />
                          <Button
                            aria-label={`Delete ${p.name}`}
                            className="border-danger text-danger"
                            size="sm"
                            type="submit"
                            variant="secondary"
                          >
                            Delete
                          </Button>
                        </fetcher.Form>
                      ) : (
                        <Tooltip
                          content={
                            p.isDefault
                              ? "It's the default policy."
                              : `Used by ${p.byTypeFields} type fields.`
                          }
                        >
                          <Button
                            aria-disabled
                            aria-label={`Delete ${p.name}`}
                            className="cursor-not-allowed bg-sunken text-muted hover:bg-sunken"
                            size="sm"
                            variant="ghost"
                          >
                            Delete
                          </Button>
                        </Tooltip>
                      )}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
        <p className="m-0 text-small text-muted">
          Delete is off for the default policy and for policies in use.
        </p>
      </div>

      <div className="grid items-start gap-5 desktop:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Panel title="Default policy">
          <Field label="Default for new secrets">
            <Choice
              onChange={(policyId) =>
                void fetcher.submit({ intent: "default-policy", policyId }, { method: "post" })
              }
              options={policies.map((p) => ({
                label: `${p.name} (${p.minLength}–${p.maxLength || "any"})`,
                value: p.id,
              }))}
              value={security.defaultPasswordPolicyId ?? ""}
            />
          </Field>
        </Panel>

        <Panel title="Security">
          <div className="flex flex-col gap-4">
            <SettingRow
              body="Checking out a secret whose type has a super-sensitive field (a card number, a PIN, a private key) needs a second factor from within the MFA window. Other types aren't affected."
              control={
                <Switch
                  aria-labelledby="set-checkout"
                  checked={security.requireMfaForSensitiveCheckout}
                  onCheckedChange={(on) => flip("requireMfaForSensitiveCheckout", on)}
                />
              }
              id="set-checkout"
              title={
                <span className="flex flex-wrap items-center gap-2">
                  Require MFA for sensitive checkout <Pill tone="ok">Recommended</Pill>
                </span>
              }
            />
            <SettingRow
              body="Before someone reveals or copies a sensitive field, they confirm a second factor again if their last one is older than the MFA window. Each folder can override this for itself and its subfolders. Tokens and service accounts are exempt."
              control={
                <Switch
                  aria-labelledby="set-reveal"
                  checked={security.requireMfaForReveal}
                  onCheckedChange={(on) => flip("requireMfaForReveal", on)}
                />
              }
              id="set-reveal"
              title="Require MFA before a reveal"
            />
            <SettingRow
              body="Off (the default): service accounts and personal tokens can't reveal, prepare or redeem a super-sensitive field; ordinary passwords and sensitive fields stay available to them. On: they get super-sensitive fields too, under their usual access. People are never affected."
              control={
                <Switch
                  aria-labelledby="set-api"
                  checked={security.allowApiForSensitive}
                  onCheckedChange={(on) => flip("allowApiForSensitive", on)}
                />
              }
              id="set-api"
              title="Allow API access to sensitive secrets"
            />
            <SettingRow
              body={
                <>
                  How recent a second factor must be for every check above, and for version history
                  and restore. It&apos;s the vault&apos;s{" "}
                  <code className="font-mono">MFA_MAX_AGE</code>: from 1 minute to 1 hour, 5 minutes
                  by default, set where the vault runs.
                </>
              }
              control={<span className="font-mono text-small text-muted">MFA_MAX_AGE</span>}
              title="MFA window"
            />
            <limits.Form className="flex flex-col gap-4 border-t border-border pt-4" method="post">
              <input name="intent" type="hidden" value="limits" />
              <Field
                hint="Resolved access requests and their comments are removed after this."
                label="Access-request history retention (days)"
              >
                <Input
                  className="max-w-32"
                  defaultValue={security.requestHistoryRetentionDays ?? 90}
                  min={1}
                  mono
                  name="retention"
                  type="number"
                />
              </Field>
              <Field
                error={minutesProblem}
                hint="Between 15 and 60. Signed-in sessions renew while they're in use."
                label="Session timeout (minutes)"
              >
                <Input
                  className="max-w-32"
                  mono
                  name="sessionMinutes"
                  onChange={(event) => setMinutes(event.target.value)}
                  type="number"
                  value={minutes}
                />
              </Field>
              <Button
                className="self-end"
                disabled={!!minutesProblem}
                loading={limits.state !== "idle"}
                loadingLabel="Saving…"
                size="sm"
                type="submit"
                variant="secondary"
              >
                Save limits
              </Button>
            </limits.Form>
          </div>
        </Panel>
      </div>
    </div>
  );
};

export default Policies;

export const ErrorBoundary = () => <PageError />;
