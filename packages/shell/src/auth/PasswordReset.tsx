import { auth, createLogger } from "@sneakers-web/api-client";
import { Alert, Button, CodeInput, Field, Input } from "@sneakers-web/ui";
import { ChevronLeft } from "lucide-react";
import { type FormEvent, useState } from "react";

import { maskEmail } from "#shell/auth/mask";
import { CenteredFrame, FrameTitle } from "#shell/gate/Frames";

const log = createLogger("password-reset");

const MIN_LENGTH = 8;

/** Self-service password reset: an emailed code, then a new password. */
export const PasswordReset = ({
  initialEmail,
  onBack,
}: {
  initialEmail: string;
  onBack: (notice?: "reset") => void;
}) => {
  const [step, setStep] = useState<"confirm" | "request">("request");
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<null | string>(null);
  const [tried, setTried] = useState(false);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setProblem("missing-email");
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      await auth.requestPasswordReset(email.trim());
      log.info("reset code requested");
      setStep("confirm");
    } catch {
      setProblem("send-failed");
    }
    setBusy(false);
  };

  const mismatch = tried && confirm !== password;
  const short = tried && password.length < MIN_LENGTH;

  const reset = async (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (code.length < 6 || password.length < MIN_LENGTH || confirm !== password) return;
    setBusy(true);
    setProblem(null);
    const r = await auth.confirmPasswordReset(email.trim(), code, password).catch(() => ({
      ok: false as const,
      reason: "unavailable" as const,
    }));
    setBusy(false);
    if (r.ok) {
      onBack("reset");
      return;
    }
    setProblem(r.reason);
  };

  if (step === "request") {
    return (
      <CenteredFrame>
        <form className="flex flex-col gap-4.5" noValidate onSubmit={send}>
          <FrameTitle body="We'll email you a code." title="Reset your password" />
          <Field
            error={problem === "missing-email" ? "Enter the email on your account." : undefined}
            label="Email"
          >
            <Input
              autoComplete="email"
              autoFocus
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              value={email}
            />
          </Field>
          <Button block loading={busy} loadingLabel="Sending…" size="lg" type="submit">
            Send reset code
          </Button>
          {problem === "send-failed" && (
            <Alert title="Couldn't send the email" tone="danger">
              Try again in a minute. If it keeps failing, ask an admin.
            </Alert>
          )}
          <Button className="self-start" onClick={() => onBack()} variant="link">
            <ChevronLeft aria-hidden />
            Back to sign-in
          </Button>
        </form>
      </CenteredFrame>
    );
  }

  return (
    <CenteredFrame>
      <form className="flex flex-col gap-4.5" noValidate onSubmit={reset}>
        <FrameTitle
          body={`We sent a code to ${maskEmail(email) ?? "your email"}.`}
          title="Check your email"
        />
        {problem === "invalid_code" && (
          <Alert title="That code didn't work" tone="danger">
            It may have expired. Ask for a new one and try again.
          </Alert>
        )}
        {problem === "weak_password" && (
          <Alert title="Pick a stronger password" tone="danger">
            Use at least {MIN_LENGTH} characters.
          </Alert>
        )}
        {problem === "unavailable" && (
          <Alert title="Reset isn't available right now" tone="danger">
            Try again in a minute. If it keeps failing, ask an admin.
          </Alert>
        )}
        <Field
          error={tried && code.length < 6 ? "Enter all 6 digits." : undefined}
          label="Code from the email"
        >
          <CodeInput
            autoFocus
            label="Code from the email"
            onChange={setCode}
            size="md"
            value={code}
          />
        </Field>
        <Field
          error={short ? `Use at least ${MIN_LENGTH} characters.` : undefined}
          hint={`At least ${MIN_LENGTH} characters.`}
          label="New password"
        >
          <Input
            autoComplete="new-password"
            mono
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            value={password}
          />
        </Field>
        <Field
          error={mismatch && !short ? "Passwords don't match." : undefined}
          label="Confirm password"
        >
          <Input
            autoComplete="new-password"
            mono
            onChange={(e) => setConfirm(e.target.value)}
            type="password"
            value={confirm}
          />
        </Field>
        <Button block loading={busy} loadingLabel="Resetting…" size="lg" type="submit">
          Reset password
        </Button>
        <div className="flex justify-between">
          <Button disabled={busy} onClick={() => setStep("request")} variant="link">
            Send a new code
          </Button>
          <Button disabled={busy} onClick={() => onBack()} variant="link">
            Back to sign-in
          </Button>
        </div>
      </form>
    </CenteredFrame>
  );
};
