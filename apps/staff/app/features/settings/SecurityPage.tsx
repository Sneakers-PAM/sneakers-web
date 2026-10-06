import { createCredential, passkeysSupported } from "@sneakers-web/api-client";
import { needsStepUp, refusalMessage, StepUpDialog, useStepUp } from "@sneakers-web/shell";
import {
  Alert,
  Button,
  Card,
  Pill,
  shortDate,
  timeAgo,
  toast,
  useIsClient,
} from "@sneakers-web/ui";
import { Check, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useFetcher, useLoaderData } from "react-router";

import type { FactorView, SecurityData, SecurityResult } from "@/features/settings/security.server";

import { MethodRow } from "@/features/settings/MethodRow";
import { RemoveAuthenticatorDialog } from "@/features/settings/RemoveAuthenticatorDialog";
import { SetupAuthenticatorDialog } from "@/features/settings/SetupAuthenticatorDialog";

const since = (f: FactorView): null | string => {
  if (!f.createdAt) return null;
  // A null lastUsedAt means the gateway doesn't know (it never records TOTP use), not "never".
  const used = f.lastUsedAt ? ` Used ${timeAgo(f.lastUsedAt)}.` : "";
  return `Added ${shortDate(f.createdAt)}.${used}`;
};

/**
 * Run each fetcher answer once: a refusal that wants a fresh factor opens the step-up prompt
 * and retries, any other refusal is a toast, and `onResult` gets the rest.
 */
const useAnswer = (
  data: SecurityResult | undefined,
  ask: (retry: () => void) => void,
  retry: () => void,
  onResult: (result: SecurityResult) => void,
) => {
  const handled = useRef<SecurityResult | undefined>(undefined);
  useEffect(() => {
    if (!data || handled.current === data) return;
    handled.current = data;
    if (!data.ok && "refusal" in data) {
      if (needsStepUp(data.refusal)) ask(retry);
      else toast.error(refusalMessage(data.refusal));
      return;
    }
    onResult(data);
    // Once per answer; the callbacks change on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);
};

/** U-17: the signed-in user's own sign-in methods. */
export const SecurityPage = () => {
  const { email, factors, listed, setup } = useLoaderData<SecurityData>();
  const stepUp = useStepUp();
  const client = useIsClient();
  const canPasskey = client && passkeysSupported();
  const remover = useFetcher<SecurityResult>();
  const starter = useFetcher<SecurityResult>();
  const confirmer = useFetcher<SecurityResult>();
  const passkey = useFetcher<SecurityResult>();
  const [confirming, setConfirming] = useState(false);
  const [enrollment, setEnrollment] = useState<{ otpauthUri: string; secret: string } | null>(null);

  const totp = factors.find((f) => f.kind === "totp");
  const passkeys = factors.filter((f) => f.kind === "passkey");
  const emailOn = factors.some((f) => f.kind === "email");

  const post = (fetcher: ReturnType<typeof useFetcher>, fields: Record<string, string>) =>
    void fetcher.submit(fields, { method: "post" });
  const remove = () => post(remover, { intent: "remove-totp" });
  const begin = () => post(starter, { intent: "totp-begin" });
  const beginPasskey = () => post(passkey, { intent: "passkey-begin" });

  useAnswer(remover.data, stepUp.ask, remove, () => {});
  useAnswer(starter.data, stepUp.ask, begin, (r) => {
    if (r.ok && r.enrollment) setEnrollment(r.enrollment);
  });
  useAnswer(
    confirmer.data,
    stepUp.ask,
    () => {},
    (r) => {
      if (!r.ok) return;
      setEnrollment(null);
      toast(r.done ?? "Authenticator app added.");
    },
  );
  useAnswer(passkey.data, stepUp.ask, beginPasskey, (r) => {
    if (r.ok && r.passkey) {
      const { optionsJson, sessionId } = r.passkey;
      void createCredential(optionsJson)
        .then((credential) =>
          post(passkey, { credential, intent: "passkey-finish", passkeySession: sessionId }),
        )
        .catch(() => toast.error("The passkey wasn't saved. Try again, or use an authenticator."));
      return;
    }
    if (r.ok && r.done) toast(r.done);
  });

  useEffect(() => {
    if (setup && !totp) begin();
    // Only on arrival from the banner's setup link.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const wrong = confirmer.data && !confirmer.data.ok && "wrong" in confirmer.data;

  return (
    <div className="flex flex-col gap-4" data-testid="security-content">
      {!totp && passkeys.length === 0 && (
        <Alert title="No second factor yet" tone="warn">
          Without one, anyone with your password can sign in as you. Set up an authenticator app or
          a passkey.
        </Alert>
      )}
      <Card className="px-5.5 py-1">
        <MethodRow
          action={
            totp ? (
              <Button
                className="border-danger text-danger hover:border-danger hover:bg-danger-soft"
                onClick={() => setConfirming(true)}
                size="sm"
                variant="secondary"
              >
                Remove…
              </Button>
            ) : (
              <Button
                loading={starter.state !== "idle"}
                loadingLabel="Starting…"
                onClick={begin}
                size="sm"
                variant="secondary"
              >
                Set up
              </Button>
            )
          }
          title="Authenticator app"
        >
          {totp ? (since(totp) ?? "Set up.") : "Not set up. Codes from an app on your phone."}
        </MethodRow>
        <MethodRow
          action={
            <Button
              disabled={!canPasskey}
              loading={passkey.state !== "idle"}
              loadingLabel="Waiting for your device…"
              onClick={beginPasskey}
              size="sm"
              variant="secondary"
            >
              <Plus aria-hidden />
              Add passkey
            </Button>
          }
          title="Passkeys"
        >
          {passkeys.length === 0 ? (
            "None yet. Faster than a code."
          ) : (
            <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
              {passkeys.map((p) => (
                <li key={p.id}>
                  {p.label}
                  {since(p) ? ` · ${since(p)}` : ""}
                </li>
              ))}
            </ul>
          )}
          {client && !canPasskey && (
            <span className="block">This browser can&apos;t use passkeys.</span>
          )}
        </MethodRow>
        <MethodRow
          action={
            emailOn ? (
              <Pill icon={<Check aria-hidden strokeWidth={3} />} tone="ok">
                On
              </Pill>
            ) : (
              <Pill tone="neutral">Off</Pill>
            )
          }
          title="Email codes"
        >
          {email}
        </MethodRow>
      </Card>
      {totp && (
        <Alert title="Removing your authenticator" tone="warn">
          You&apos;ll set up a new one at your next sign-in. Remove it only if you lost your phone
          or are switching apps.
        </Alert>
      )}
      {!listed && (
        <p className="m-0 text-small text-muted">
          This server doesn&apos;t list sign-in methods yet, so dates and passkeys aren&apos;t
          shown.
        </p>
      )}
      <RemoveAuthenticatorDialog
        onConfirm={remove}
        onOpenChange={setConfirming}
        open={confirming}
      />
      <SetupAuthenticatorDialog
        busy={confirmer.state !== "idle"}
        enrollment={enrollment}
        onConfirm={(code) => post(confirmer, { code, intent: "totp-confirm" })}
        onOpenChange={(open) => {
          if (!open) setEnrollment(null);
        }}
        wrong={wrong ? confirmer.data : undefined}
      />
      <StepUpDialog
        {...stepUp.dialog}
        description="Changing how you sign in needs a fresh second factor."
      />
    </div>
  );
};
