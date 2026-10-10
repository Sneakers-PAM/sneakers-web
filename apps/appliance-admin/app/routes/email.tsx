import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  Checkbox,
  EmptyState,
  Field,
  Input,
  Label,
  PageHeader,
  Segmented,
  Switch,
  Textarea,
} from "@sneakers-web/ui";
import { useEffect, useState } from "react";

import type { EmailSettings, EmailTls, GetEmailResponse } from "@/lib/osadmin/types";

import { NotAvailable } from "@/components/NotAvailable";
import { PasswordInput } from "@/components/PasswordInput";
import { noAutofill } from "@/lib/noAutofill";
import { runAction } from "@/lib/osadmin/action";
import { email } from "@/lib/osadmin/client";
import { isNotAvailable } from "@/lib/osadmin/errors";
import { useInstalledProduct } from "@/lib/useInstalledProduct";

/** The words shown for each TLS mode, and the port each one usually takes. */
const TLS_OPTIONS: { hint: string; label: string; port: number; value: EmailTls }[] = [
  { hint: "Plain SMTP: nothing is encrypted.", label: "None", port: 25, value: "EMAIL_TLS_NONE" },
  {
    hint: "Upgraded with STARTTLS before anything is sent; a relay that doesn't offer it is refused.",
    label: "STARTTLS",
    port: 587,
    value: "EMAIL_TLS_STARTTLS",
  },
  { hint: "TLS from the first byte.", label: "TLS", port: 465, value: "EMAIL_TLS_IMPLICIT" },
];

const UNENCRYPTED_WARNING = "Mail and the relay password are sent unencrypted";

/** Whether mail goes to the relay encrypted and verified. */
const encrypted = (s: EmailSettings) => s.tls !== "EMAIL_TLS_NONE" && s.verify;

/**
 * One of the installed product's pages: the mail relay the product sends its mail through. The
 * relay password is write-only; the box only says whether one is saved.
 */
export default function Email() {
  const { loaded, product } = useInstalledProduct();
  const [data, setData] = useState<GetEmailResponse>();
  const [unavailable, setUnavailable] = useState(false);
  const [form, setForm] = useState<EmailSettings>();
  const [port, setPort] = useState("");
  const [password, setPassword] = useState("");
  const [clearPassword, setClearPassword] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [testAnswer, setTestAnswer] = useState("");
  const [saved, setSaved] = useState(false);

  const reload = () =>
    void email
      .get()
      .then((answer) => {
        setData(answer);
        setForm(answer.settings);
        setPort(answer.settings.port ? String(answer.settings.port) : "");
        setPassword("");
        setClearPassword(false);
      })
      .catch((error: unknown) => {
        if (isNotAvailable(error)) setUnavailable(true);
      });
  useEffect(() => {
    if (product) reload();
  }, [product]);

  if (!loaded) return null;
  if (!product) {
    return (
      <div className="p-5.5">
        <EmptyState
          body="This page belongs to a product, and no product is installed on this box."
          loader={false}
          title="Nothing here"
        />
      </div>
    );
  }
  if (unavailable) {
    return (
      <div className="p-5.5">
        <NotAvailable name="Email" />
      </div>
    );
  }
  if (!data || !form) return null;

  if (data.state === "not in this product") {
    return (
      <div className="flex flex-col gap-5 p-5.5">
        <PageHeader eyebrow={product.name} title="Email" />
        <Card>
          <div className="p-5.5">
            <p className="m-0 text-small">
              {product.name} sends no mail, so there&apos;s no relay to set.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  const settings: EmailSettings = { ...form, port: Number.parseInt(port, 10) || 0 };
  const update = (patch: Partial<EmailSettings>) => setForm({ ...form, ...patch });
  const typedPassword = (): string | undefined => {
    if (clearPassword) return "";
    return password || undefined;
  };
  const save = () =>
    void runAction(() => email.set({ password: typedPassword(), settings }), {
      onSuccess: () => {
        setSaved(true);
        reload();
      },
    });
  const sendTest = () => {
    setTestAnswer("");
    void runAction(
      () => email.test({ password: password || undefined, settings, to: testTo.trim() }),
      { onSuccess: (answer) => setTestAnswer(answer.answer ?? "Sent.") },
    );
  };
  const tlsHint = TLS_OPTIONS.find((o) => o.value === form.tls)?.hint;

  return (
    <div className="flex flex-col gap-5 p-5.5">
      <PageHeader eyebrow={product.name} title="Email" />
      <Card>
        <CardHeader
          aside={
            <Badge tone={data.state === "set" ? "ok" : "neutral"}>
              {data.state === "set" ? "Relay set" : "No relay"}
            </Badge>
          }
          subtitle={`The relay ${product.name} sends its mail through${data.label ? `: ${data.label.toLowerCase()}` : ""}. Saving needs a fresh code and applies the product again.`}
          title="Mail relay"
        />
        <form
          className="flex flex-col gap-4 p-5.5"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          {data.state !== "set" && (
            <p className="m-0 text-small">
              No relay is set: {product.name} sends no mail until one is.
            </p>
          )}
          {!encrypted(settings) && (
            <Alert role="alert" title={UNENCRYPTED_WARNING} tone="warn">
              {form.tls === "EMAIL_TLS_NONE"
                ? "With TLS off, anyone on the path to the relay can read the mail and the relay password."
                : "With verification off, the box doesn't check it is talking to your relay, so another host could take the mail and the password."}{" "}
              Use STARTTLS or TLS with verification on wherever the relay supports it.
            </Alert>
          )}
          <Field hint="Empty for no relay." label="Relay host">
            <Input
              {...noAutofill()}
              onChange={(event) => update({ host: event.target.value.trim() })}
              placeholder="smtp.example.org"
              value={form.host}
            />
          </Field>
          <Field label="Port">
            <Input
              inputMode="numeric"
              onChange={(event) => setPort(event.target.value)}
              value={port}
            />
          </Field>
          <Field label="From address">
            <Input
              {...noAutofill()}
              onChange={(event) => update({ from: event.target.value.trim() })}
              placeholder="no-reply@example.org"
              value={form.from}
            />
          </Field>
          <div className="flex flex-col gap-2">
            <Label>TLS</Label>
            <Segmented
              label="TLS"
              onChange={(tls: EmailTls) => {
                const was = TLS_OPTIONS.find((o) => o.value === form.tls)?.port;
                const next = TLS_OPTIONS.find((o) => o.value === tls)?.port;
                if (next && (!port || Number(port) === was)) setPort(String(next));
                update({ tls });
              }}
              options={TLS_OPTIONS.map((o) => ({ label: o.label, value: o.value }))}
              value={form.tls === "EMAIL_TLS_UNSPECIFIED" ? "EMAIL_TLS_STARTTLS" : form.tls}
            />
            {tlsHint && <span className="text-small text-muted">{tlsHint}</span>}
          </div>
          <Label className="flex items-center gap-3">
            <Switch checked={form.verify} onCheckedChange={(verify) => update({ verify })} />
            Verify the certificate
          </Label>
          <Field hint="Optional: the CA that signed the relay's certificate, PEM." label="Relay CA">
            <Textarea
              onChange={(event) => update({ caPem: event.target.value })}
              placeholder="-----BEGIN CERTIFICATE-----"
              rows={4}
              value={form.caPem}
            />
          </Field>
          <input
            accept=".pem,.crt,.cer"
            aria-label="Relay CA file"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void file.text().then((caPem) => update({ caPem }));
            }}
            type="file"
          />
          <Field hint="Empty for a relay that takes mail without signing in." label="Username">
            <Input
              {...noAutofill()}
              onChange={(event) => update({ username: event.target.value })}
              value={form.username}
            />
          </Field>
          <Field
            hint={
              data.passwordSet
                ? "A password is saved. Type a new one to replace it; leave it empty to keep it."
                : "No password is saved."
            }
            label="Password"
          >
            <PasswordInput
              {...noAutofill("new-password")}
              autoComplete="new-password"
              disabled={clearPassword}
              label="the relay password"
              onChange={setPassword}
              value={password}
            />
          </Field>
          {data.passwordSet && (
            <Label className="flex items-center gap-3">
              <Checkbox
                aria-label="Clear the saved password"
                checked={clearPassword}
                onCheckedChange={(checked) => setClearPassword(checked === true)}
              />
              Clear the saved password
            </Label>
          )}
          {saved && (
            <p className="m-0 text-small" role="status">
              Saved: the product is applied again with the new settings, and its mail sender
              restarts once they&apos;re in place.
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <Button type="submit">Save and apply</Button>
          </div>
        </form>
      </Card>
      <Card>
        <CardHeader
          subtitle="Sends one short message through the settings above (with the saved password unless you typed one). Nothing is saved."
          title="Test email"
        />
        <div className="flex flex-col gap-4 p-5.5">
          <Field label="Send a test to">
            <Input
              {...noAutofill()}
              onChange={(event) => setTestTo(event.target.value)}
              placeholder="you@example.org"
              value={testTo}
            />
          </Field>
          <div className="flex flex-wrap gap-3">
            <Button
              disabled={!testTo.trim() || !settings.host}
              onClick={sendTest}
              variant="secondary"
            >
              Send test email
            </Button>
          </div>
          {testAnswer && (
            <p className="m-0 text-small" role="status">
              Sent: {testAnswer}.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
