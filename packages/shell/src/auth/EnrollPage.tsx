import { createCredential, passkeysSupported } from "@sneakers-web/api-client";
import {
  Alert,
  Button,
  CodeInput,
  QrBlock,
  Segmented,
  Skeleton,
  useIsClient,
} from "@sneakers-web/ui";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  Form,
  useActionData,
  useHref,
  useLoaderData,
  useNavigation,
  useSubmit,
} from "react-router";

import type { EnrollLoaderData, EnrollState } from "#shell/server/enroll.server";

import { groupKey } from "#shell/auth/mask";
import { CenteredFrame, FrameTitle } from "#shell/gate/Frames";

type Method = "authenticator" | "passkey" | "token";

/**
 * G-08: add a second factor. When MFA is enforced this is a wall (the only other way out is
 * signing out); otherwise it can be skipped.
 */
export const EnrollPage = () => {
  const { enforced, enrollment, next } = useLoaderData<EnrollLoaderData>();
  const nextHref = useHref(next);
  const state = useActionData<EnrollState>() ?? { view: "form" as const };
  const submit = useSubmit();
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";
  const form = useRef<HTMLFormElement>(null);
  const [method, setMethod] = useState<Method>("authenticator");
  const [code, setCode] = useState("");
  const canPasskey = useIsClient() && passkeysSupported();

  useEffect(() => {
    if (state.view !== "passkey") return;
    void createCredential(state.passkeyOptions)
      .then((credential) =>
        submit(
          { credential, intent: "passkey-finish", next, passkeySession: state.passkeySession },
          { method: "post" },
        ),
      )
      .catch(() => submit({ intent: "passkey-cancelled", next }, { method: "post" }));
    // Run once per set of passkey options the server hands back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const problem =
    state.view === "form" && state.problem === "passkey"
      ? "The passkey wasn't saved. Try again, or use an authenticator app."
      : state.view === "form" && state.problem === "start"
        ? "The setup didn't finish. Try again in a moment."
        : enrollment
          ? null
          : "We couldn't start the setup. Refresh the page and try again.";
  const wrong = state.view === "form" && !!state.wrong && code.length === 0;

  return (
    <CenteredFrame>
      <FrameTitle
        body={
          enforced
            ? "Your administrator requires it. You can't use Sneakers-PAM until this is done."
            : "Add a second factor so a stolen password isn't enough to get in."
        }
        title={enforced ? "Set up a second factor to continue" : "Protect your account"}
      />
      <Form className="flex flex-col gap-4.5" method="post" noValidate ref={form}>
        <input name="next" type="hidden" value={next} />
        <Segmented<Method>
          label="Second factor"
          onChange={setMethod}
          options={[
            { label: "Authenticator", value: "authenticator" },
            { disabled: !canPasskey, label: "Passkey", value: "passkey" },
            { label: "Token", value: "token" },
          ]}
          value={method}
        />
        {problem && <Alert tone="danger">{problem}</Alert>}
        {method === "passkey" ? (
          <>
            <p className="m-0 text-[0.875rem] leading-[1.45]">
              Your device will ask to save a passkey for Sneakers-PAM. Use your fingerprint, face or
              device PIN to confirm.
            </p>
            <Button
              block
              loading={busy}
              loadingLabel="Waiting for your device…"
              name="intent"
              size="lg"
              type="submit"
              value="passkey-begin"
            >
              Register a passkey
            </Button>
          </>
        ) : (
          <>
            <div className="flex flex-col items-start gap-4 tablet:flex-row tablet:items-center">
              {method === "authenticator" &&
                (enrollment?.otpauthUri ? (
                  <QrBlock
                    label="Authenticator setup code"
                    size={148}
                    value={enrollment.otpauthUri}
                  />
                ) : (
                  <Skeleton className="size-42 rounded-lg" />
                ))}
              <div className="flex min-w-0 flex-col gap-2">
                <span className="text-[0.875rem] leading-[1.4]">
                  {method === "authenticator"
                    ? "1. Scan with your authenticator app."
                    : "1. Program this key into your token."}
                </span>
                {method === "authenticator" && (
                  <span className="text-small text-muted">Can&apos;t scan? Enter this key:</span>
                )}
                <span className="rounded-sm bg-sunken px-2.5 py-2 font-mono text-[0.875rem] leading-normal font-medium break-all">
                  {enrollment ? groupKey(enrollment.secret) : "…"}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-[0.875rem] leading-[1.4]">
                2. Enter the 6-digit code it shows.
              </span>
              <CodeInput
                invalid={wrong}
                name="code"
                onChange={setCode}
                onComplete={() =>
                  form.current?.requestSubmit(
                    form.current.querySelector<HTMLButtonElement>("[value=confirm]"),
                  )
                }
                size="md"
                value={code}
              />
              {wrong && (
                <span className="text-small font-bold text-danger" role="alert">
                  <X aria-hidden className="mr-1 inline size-3.5 align-[-2px]" strokeWidth={3} />
                  That code didn&apos;t match. Check the time on your phone.
                </span>
              )}
            </div>
            <Button
              block
              disabled={!enrollment}
              loading={busy}
              loadingLabel="Confirming…"
              name="intent"
              size="lg"
              type="submit"
              value="confirm"
            >
              Confirm &amp; continue
            </Button>
          </>
        )}
      </Form>
      <div className="flex justify-between gap-4 text-[0.875rem] font-bold">
        {method === "passkey" || !canPasskey ? (
          <span />
        ) : (
          <Button onClick={() => setMethod("passkey")} variant="link">
            Set up a passkey instead
          </Button>
        )}
        {enforced ? (
          <Form action="/sign-out" method="post">
            <Button type="submit" variant="link">
              Sign out
            </Button>
          </Form>
        ) : (
          <Button asChild variant="link">
            <a href={nextHref}>Skip for now</a>
          </Button>
        )}
      </div>
    </CenteredFrame>
  );
};
