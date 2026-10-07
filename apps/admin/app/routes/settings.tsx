import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import {
  AdminPoliciesDocument,
  AdminUpdateSecuritySettingsDocument,
  type SecuritySettingsInput,
} from "@sneakers-web/api-client";
import { Button, Field, Input, PageHeader, Pill, Switch } from "@sneakers-web/ui";
import { useState } from "react";
import { useFetcher, useLoaderData } from "react-router";

import { Panel, SettingRow, useResultToast } from "@/components/Admin";
import { PageError } from "@/components/PageError";
import { adminAct, adminLoad, text } from "@/lib/admin.server";

export const loader = ({ request }: LoaderFunctionArgs) =>
  adminLoad(request, async (gw) => {
    const d = await gw.gql(AdminPoliciesDocument);
    return { security: d.securitySettings };
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
    const input: SecuritySettingsInput = {};
    let note = "Saved.";
    if (intent === "switch") {
      const key = text(form, "key") as keyof typeof SWITCHES;
      if (!(key in SWITCHES)) throw new Error("unknown setting");
      input[key] = text(form, "on") === "true";
      note = `Saved · ${SWITCHES[key]} ${input[key] ? "on" : "off"}.`;
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

export const meta = () => [{ title: "Settings · Sneakers-PAM admin console" }];

const Settings = () => {
  const { security } = useLoaderData<typeof loader>();
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
        eyebrow="Configuration · Settings"
        subtitle="Security rules for MFA, reveals and sessions."
        title="Settings"
      />
      <Panel className="max-w-[40rem]" title="Security">
        <div className="flex flex-col gap-4">
          <SettingRow
            body="Checking out a secret whose type has a highly sensitive field (a card number, a PIN, a private key) needs a second factor from within the MFA window. Other types aren't affected."
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
            body="Off (the default): service accounts and personal tokens can't reveal, prepare or redeem a highly sensitive field; ordinary passwords and sensitive fields stay available to them. On: they get highly sensitive fields too, under their usual access. People are never affected."
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
  );
};

export default Settings;

export const ErrorBoundary = () => <PageError />;
