import {
  auth,
  createCredential,
  createLogger,
  passkeysSupported,
  type TotpEnrollment,
} from "@sneakers-web/api-client";
import { Alert, Button, CodeInput, QrBlock, Segmented, Skeleton } from "@sneakers-web/ui";
import { useCallback, useEffect, useRef, useState } from "react";

import { groupKey } from "#shell/auth/mask";

const log = createLogger("mfa-enrol");

type Method = "authenticator" | "passkey" | "token";

/**
 * Add a second factor: scan a code into an authenticator app (or program the key into a
 * hardware token), or register a passkey. Used by the enrolment wall and the setup dialog.
 */
export const EnrollFactor = ({
  onDone,
  secondary,
}: {
  onDone: () => void;
  /** The right-hand link under the button: "Skip for now" or "Sign out". */
  secondary?: React.ReactNode;
}) => {
  const [method, setMethod] = useState<Method>("authenticator");
  const [enrollment, setEnrollment] = useState<null | TotpEnrollment>(null);
  const [code, setCode] = useState("");
  const [wrong, setWrong] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<null | string>(null);
  const started = useRef(false);
  const canPasskey = passkeysSupported();

  const start = useCallback(async () => {
    setProblem(null);
    try {
      setEnrollment(await auth.beginTotpEnrollment());
    } catch {
      log.warn("could not start authenticator enrolment");
      setProblem("We couldn't start the setup. Refresh the page and try again.");
    }
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void start();
  }, [start]);

  const confirm = async (value = code) => {
    if (value.length < 6 || busy) return;
    setBusy(true);
    setWrong(false);
    try {
      if (await auth.confirmTotpEnrollment(value)) {
        onDone();
        return;
      }
      setWrong(true);
    } catch {
      setProblem("The setup didn't finish. Try again in a moment.");
    }
    setBusy(false);
  };

  const passkey = async () => {
    setBusy(true);
    setProblem(null);
    try {
      const { optionsJson, sessionId } = await auth.beginPasskeyEnrollment();
      const credential = await createCredential(optionsJson);
      await auth.finishPasskeyEnrollment(sessionId, credential, "Passkey");
      onDone();
      return;
    } catch {
      setProblem("The passkey wasn't saved. Try again, or use an authenticator app.");
    }
    setBusy(false);
  };

  return (
    <div className="flex flex-col gap-4.5">
      <Segmented<Method>
        label="Second factor"
        onChange={(m) => {
          setMethod(m);
          setProblem(null);
        }}
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
            onClick={() => void passkey()}
            size="lg"
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
                <span className="text-small text-muted">Can't scan? Enter this key:</span>
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
              onChange={(v) => {
                setCode(v);
                setWrong(false);
              }}
              onComplete={(v) => void confirm(v)}
              size="md"
              value={code}
            />
            {wrong && (
              <span className="text-small font-bold text-danger" role="alert">
                ✕ That code didn't match. Check the time on your phone.
              </span>
            )}
          </div>
          <Button
            block
            disabled={!enrollment}
            loading={busy}
            loadingLabel="Confirming…"
            onClick={() => void confirm()}
            size="lg"
          >
            Confirm &amp; continue
          </Button>
        </>
      )}
      <div className="flex justify-between gap-4 text-[0.875rem] font-bold">
        {method !== "passkey" && canPasskey ? (
          <Button onClick={() => setMethod("passkey")} variant="link">
            Set up a passkey instead
          </Button>
        ) : (
          <span />
        )}
        {secondary}
      </div>
    </div>
  );
};
