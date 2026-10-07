import { Alert, Button, Checkbox, CodeInput, Field, Input, Label } from "@sneakers-web/ui";
import { useState } from "react";

import type { GetSetupResponse } from "@/lib/osadmin/types";

import { PasswordInput } from "@/components/PasswordInput";
import { runAction } from "@/lib/osadmin/action";
import { setup, signIn } from "@/lib/osadmin/client";
import { refusalMessage } from "@/lib/osadmin/refusal";
import { setSession } from "@/lib/osadmin/sessionStore";

/**
 * Step 6: one sign-in with the name, password and code, which shows the admin can get back in,
 * then Finish closes setup. With a single admin the warning has to be confirmed first.
 */
export const FinishStep = ({
  data,
  onBack,
  onFinished,
}: {
  data: GetSetupResponse;
  onBack: () => void;
  onFinished: (productSetupUrl: string) => void;
}) => {
  const [admin, setAdmin] = useState(data.firstAdmin ?? "");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [understood, setUnderstood] = useState(data.singleAdminAcknowledged);
  const [refusal, setRefusal] = useState("");
  const [busy, setBusy] = useState(false);
  const keys = data.recoveryKeys?.length ?? 0;
  const needsAck = data.singleAdminWarning && !understood;

  const finish = () => {
    setBusy(true);
    setRefusal("");
    signIn
      .signIn(admin.trim(), password, code)
      .then(async (response) => {
        setSession(response.session);
        await runAction(() => setup.finish(), {
          onSuccess: (result) => onFinished(result.productSetupUrl),
        });
      })
      .catch((error: unknown) => {
        setRefusal(refusalMessage(error, { what: "sign-in", who: admin.trim() }));
        setPassword("");
        setCode("");
      })
      .finally(() => setBusy(false));
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        finish();
      }}
    >
      <p className="m-0 text-body">
        Last step: sign in once with your name, password and code. This shows that you can get back
        in, and closes setup.
      </p>
      <dl className="m-0 flex flex-col gap-1.5 text-small">
        <div className="flex gap-4">
          <dt className="w-32 shrink-0 text-muted">Admins</dt>
          <dd className="m-0">
            {data.adminCount === 1 && data.firstAdmin
              ? `${data.firstAdmin} (owner)`
              : String(data.adminCount)}
          </dd>
        </div>
        <div className="flex gap-4">
          <dt className="w-32 shrink-0 text-muted">Recovery keys</dt>
          <dd className="m-0">{keys}</dd>
        </div>
      </dl>
      {data.singleAdminWarning && (
        <Alert tone="warn">
          <div className="flex flex-col gap-3">
            <p className="m-0">
              {data.firstAdmin || "This admin"} is the only admin. With one admin there is no
              quorum, so a factory reset means re-creating the box. You can add admins on the Access
              page once you&apos;re signed in.
            </p>
            <Label className="flex items-center gap-2">
              <Checkbox
                checked={understood}
                onCheckedChange={(checked) => {
                  const next = checked === true;
                  setUnderstood(next);
                  if (next) void runAction(() => setup.acknowledgeSingleAdmin());
                }}
              />
              I understand. Go on with one admin.
            </Label>
          </div>
        </Alert>
      )}
      {refusal && (
        <Alert role="alert" tone="danger">
          {refusal}
        </Alert>
      )}
      <Field label="Admin name">
        <Input
          autoCapitalize="none"
          autoComplete="username"
          onChange={(event) => setAdmin(event.target.value)}
          spellCheck={false}
          value={admin}
        />
      </Field>
      <Field label="Password">
        <PasswordInput onChange={setPassword} value={password} />
      </Field>
      <Field label="Authenticator code">
        <CodeInput label="Authenticator code" onChange={setCode} size="md" value={code} />
      </Field>
      <div className="flex justify-between gap-3">
        <Button onClick={onBack} type="button" variant="secondary">
          Back
        </Button>
        <Button
          disabled={busy || needsAck || !admin.trim() || !password || code.length !== 6}
          type="submit"
        >
          Sign in and finish
        </Button>
      </div>
    </form>
  );
};
