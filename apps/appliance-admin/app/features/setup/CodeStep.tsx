import { Alert, Button, Field, Input, plural } from "@sneakers-web/ui";
import { useState } from "react";

import type { RedeemCodeResponse } from "@/lib/osadmin/types";

import { setup } from "@/lib/osadmin/client";
import { refusalOf } from "@/lib/osadmin/errors";
import { refusalMessage } from "@/lib/osadmin/refusal";
import { setCodeCsrfToken } from "@/lib/osadmin/sessionStore";

/** What a refused code means: the tries left before the console shows a new one. */
const codeRefusal = (error: unknown): string => {
  const refusal = refusalOf(error);
  if (refusal && !refusal.retryAfter && !refusal.lockedUntil) {
    return refusal.attemptsLeft > 0
      ? `That code didn't work. ${plural(refusal.attemptsLeft, "try", "tries")} left before the console shows a new code.`
      : "That code didn't work, and it's used up. Type the new code the console shows.";
  }
  return refusalMessage(error, { what: "code" });
};

/** Step 1, and the way in for an invitation or a Recover access code: one typed code. */
export const CodeStep = ({
  onRedeemed,
}: {
  onRedeemed: (response: RedeemCodeResponse) => void;
}) => {
  const [code, setCode] = useState("");
  const [refusal, setRefusal] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = () => {
    setBusy(true);
    setRefusal("");
    setup
      .redeemCode(code.trim())
      .then((response) => {
        setCodeCsrfToken(response.csrfToken ?? "");
        onRedeemed(response);
      })
      .catch((error: unknown) => setRefusal(codeRefusal(error)))
      .finally(() => setBusy(false));
  };
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <p className="m-0 text-body">
        Type the code shown on the appliance&apos;s console, or the invitation code an owner gave
        you.
      </p>
      {refusal && (
        <Alert role="alert" tone="danger">
          {refusal}
        </Alert>
      )}
      <Field
        hint="16 characters, XXXX-XXXX-XXXX-XXXX. Dashes and capital letters don't matter."
        label="Setup code"
      >
        <Input
          autoCapitalize="characters"
          autoComplete="one-time-code"
          mono
          onChange={(event) => setCode(event.target.value)}
          placeholder="XXXX-XXXX-XXXX-XXXX"
          spellCheck={false}
          value={code}
        />
      </Field>
      <Button disabled={busy || !code.trim()} type="submit">
        Continue
      </Button>
    </form>
  );
};
