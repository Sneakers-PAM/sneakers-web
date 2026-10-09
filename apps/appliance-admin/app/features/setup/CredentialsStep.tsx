import { Alert, Button, Field, Input } from "@sneakers-web/ui";
import { type ReactNode, useCallback, useState } from "react";

import type { CodeKind, Session, TotpEnrolment } from "@/lib/osadmin/types";

import { type NewPassword, NewPasswordFields } from "@/components/NewPasswordFields";
import { TotpEnrolmentPanel } from "@/components/TotpEnrolmentPanel";
import { noAutofill } from "@/lib/noAutofill";
import { setup } from "@/lib/osadmin/client";
import { plainMessage, refusalOf } from "@/lib/osadmin/errors";
import { refusalMessage } from "@/lib/osadmin/refusal";

/**
 * Step 2 (and an invitation's or Recover access's only page): the admin's name and password,
 * then the authenticator. Nothing is stored until the new authenticator's code checks out.
 */
export const CredentialsStep = ({
  fixedAdmin,
  header,
  kind,
  onDone,
  owners = [],
}: {
  /** An invitation's admin: the name is shown, not chosen. */
  fixedAdmin?: string;
  /** The page's title for each half: the name and password, then the authenticator. */
  header: (phase: "authenticator" | "password") => ReactNode;
  kind: CodeKind;
  onDone: (session: Session) => void;
  /** The owners a Recover access code may reset. */
  owners?: string[];
}) => {
  const [admin, setAdmin] = useState(fixedAdmin ?? "");
  const [password, setPassword] = useState<NewPassword>({ again: "", password: "" });
  const [valid, setValid] = useState(false);
  const [enrolment, setEnrolment] = useState<TotpEnrolment>();
  const [code, setCode] = useState("");
  const [refusal, setRefusal] = useState("");
  const [busy, setBusy] = useState(false);
  const onValid = useCallback((next: boolean) => setValid(next), []);

  const begin = () => {
    setBusy(true);
    setRefusal("");
    setup
      .beginCredentials(admin.trim(), password.password)
      .then((response) => setEnrolment(response.totp))
      .catch((error: unknown) =>
        setRefusal(error instanceof Error ? plainMessage(error) : "The appliance refused."),
      )
      .finally(() => setBusy(false));
  };

  const complete = (enrolmentId: string) => {
    setBusy(true);
    setRefusal("");
    setup
      .completeCredentials(enrolmentId, code)
      .then((response) => onDone(response.session))
      .catch((error: unknown) => {
        setRefusal(
          refusalOf(error)
            ? refusalMessage(error, { what: "code" })
            : error instanceof Error
              ? plainMessage(error)
              : "The appliance refused.",
        );
        setCode("");
      })
      .finally(() => setBusy(false));
  };

  if (enrolment) {
    return (
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          complete(enrolment.id);
        }}
      >
        {header("authenticator")}
        <p className="m-0 text-body">
          Every sign-in needs a code from an authenticator app as well as the password. This step
          can&apos;t be skipped.
        </p>
        {refusal && (
          <Alert role="alert" tone="danger">
            {refusal}
          </Alert>
        )}
        <TotpEnrolmentPanel code={code} enrolment={enrolment} onCode={setCode} />
        <p className="m-0 text-small text-muted">
          If you lose your authenticator, another owner can reset it, or use Recover access on the
          console.
        </p>
        <div className="flex justify-between gap-3">
          <Button
            onClick={() => {
              setEnrolment(undefined);
              setCode("");
              setRefusal("");
            }}
            type="button"
            variant="secondary"
          >
            Back
          </Button>
          <Button disabled={busy || code.length !== 6} type="submit">
            Continue
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        begin();
      }}
    >
      {header("password")}
      <p className="m-0 text-body">
        {kind === "CODE_KIND_SETUP"
          ? "This admin is an owner and the first root operator: they can add admins, change the access settings and open the root shell."
          : kind === "CODE_KIND_RECOVER"
            ? "A new password and authenticator for an owner, or a new owner."
            : "Set the password and the authenticator you'll sign in with."}
      </p>
      {refusal && (
        <Alert role="alert" tone="danger">
          {refusal}
        </Alert>
      )}
      <Field
        hint={
          kind === "CODE_KIND_RECOVER" && owners.length > 0
            ? `Owners now: ${owners.join(", ")}. A new name makes a new owner.`
            : undefined
        }
        label="Admin name"
      >
        <Input
          {...noAutofill()}
          autoCapitalize="none"
          onChange={(event) => setAdmin(event.target.value)}
          readOnly={!!fixedAdmin}
          spellCheck={false}
          value={admin}
        />
      </Field>
      <NewPasswordFields
        admin={admin.trim()}
        onChange={setPassword}
        onValid={onValid}
        value={password}
      />
      <p className="m-0 text-small text-muted">Known-breached passwords are refused.</p>
      <Button disabled={busy || !admin.trim() || !valid} type="submit">
        Continue
      </Button>
    </form>
  );
};
