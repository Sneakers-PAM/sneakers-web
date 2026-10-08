import {
  Alert,
  Button,
  Card,
  CardHeader,
  clockTime,
  CodeInput,
  Countdown,
  Field,
  Input,
  PageHeader,
} from "@sneakers-web/ui";
import { useState } from "react";

import type { IssueRootShellCodeResponse } from "@/lib/osadmin/types";

import { rootShell } from "@/lib/osadmin/client";
import { refusalOf } from "@/lib/osadmin/errors";
import { refusalMessage } from "@/lib/osadmin/refusal";
import { useSession } from "@/lib/useSession";

/**
 * The root-shell code page: a root operator pastes the challenge their SSH menu shows, adds a
 * fresh TOTP code, and gets a one-use code made with the box's root key to type back into SSH.
 */
export default function RootShell() {
  const { session } = useSession();
  const [challenge, setChallenge] = useState("");
  const [code, setCode] = useState("");
  const [refusal, setRefusal] = useState("");
  const [issued, setIssued] = useState<IssueRootShellCodeResponse>();
  const [busy, setBusy] = useState(false);

  if (!session?.rootOperator) {
    return (
      <div className="flex flex-col gap-5 p-5.5">
        <PageHeader eyebrow="Access" title="Root shell" />
        <Alert tone="info">
          Only root operators can open the root shell. An owner adds you to the root-operator roster
          on the Access page.
        </Alert>
      </div>
    );
  }

  const submit = () => {
    setBusy(true);
    setRefusal("");
    rootShell
      .issueCode(challenge.trim(), code)
      .then(setIssued)
      .catch((error: unknown) => {
        setRefusal(
          refusalOf(error)
            ? refusalMessage(error, { what: "code", who: session.admin })
            : error instanceof Error
              ? error.message
              : "The appliance refused.",
        );
        setCode("");
      })
      .finally(() => setBusy(false));
  };

  return (
    <div className="flex max-w-3xl flex-col gap-5 p-5.5">
      <PageHeader eyebrow="Access" title="Root shell" />
      {issued ? (
        <section aria-label="Your root-shell code">
          <Card>
            <CardHeader title="Type this into your SSH session" />
            <div className="flex flex-col gap-4 p-5.5">
              <output
                aria-label="Root-shell code"
                className="block rounded-md border-[1.5px] border-control bg-sunken py-4 text-center font-mono text-[1.75rem] font-bold tracking-[0.2em]"
              >
                {issued.code}
              </output>
              {issued.expires && (
                <div className="flex flex-wrap items-center gap-3">
                  <p className="m-0 text-body">
                    It works once, for this challenge only, until {clockTime(issued.expires)}.
                  </p>
                  <Countdown label="Code expires" until={Date.parse(issued.expires)} />
                </div>
              )}
              <p className="m-0 text-body">
                The root shell may stay open {issued.sessionMinutes} minutes, and it&apos;s
                recorded.
              </p>
              <Alert tone="warn">
                The challenge came from the SSH session at {issued.sourceAddress}. If that
                isn&apos;t you, don&apos;t use the code; it lapses on its own.
              </Alert>
              <div>
                <Button
                  onClick={() => {
                    setIssued(undefined);
                    setChallenge("");
                    setCode("");
                  }}
                  variant="secondary"
                >
                  Answer another challenge
                </Button>
              </div>
            </div>
          </Card>
        </section>
      ) : (
        <Card>
          <CardHeader title="Get a root-shell code" />
          <form
            className="flex flex-col gap-4 p-5.5"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <ol className="m-0 flex flex-col gap-1.5 pl-5 text-body">
              <li>In your SSH session, choose Root shell in the menu. It shows a challenge.</li>
              <li>Paste the challenge here and type a new code from your authenticator.</li>
              <li>Type the code this page shows back into SSH.</li>
            </ol>
            {refusal && (
              <Alert role="alert" tone="danger">
                {refusal}
              </Alert>
            )}
            <Field
              hint="XXXX-XXXX-XXXX-XXXX. Dashes, spaces and case don't matter."
              label="Challenge from the SSH menu"
            >
              <Input
                autoCapitalize="characters"
                autoComplete="off"
                mono
                onChange={(event) => setChallenge(event.target.value)}
                spellCheck={false}
                value={challenge}
              />
            </Field>
            <Field label="Authenticator code">
              <CodeInput label="Authenticator code" onChange={setCode} size="md" value={code} />
            </Field>
            <div>
              <Button disabled={busy || !challenge.trim() || code.length !== 6} type="submit">
                Get the code
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
