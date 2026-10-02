import {
  auth,
  createLogger,
  getAssertion,
  NetworkError,
  passkeysSupported,
  runtimeConfig,
  type SecondFactor,
} from "@sneakers-web/api-client";
import { Alert, Button, CodeInput, Field, Input, Segmented, SneakerLoader } from "@sneakers-web/ui";
import { ChevronLeft, KeyRound } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";

import { maskEmail } from "#shell/auth/mask";
import { PasswordReset } from "#shell/auth/PasswordReset";
import { SignInLayout, SignInTitle } from "#shell/gate/Frames";

const log = createLogger("sign-in");

type View =
  | { factors: SecondFactor[]; name: "code"; pendingId: string }
  | { failed: boolean; name: "sso" }
  | { name: "done"; who: string }
  | { name: "local"; notice?: "reset" }
  | { name: "reset" };

const WELCOME_MS = 1400;

/**
 * Sign-in: single sign-on first (when the install has it), a local password login, the
 * second-factor step and password reset. The gateway does the checks with Ory; this
 * screen only collects what it asks for.
 */
export const SignIn = ({
  onSignedIn,
  sessionEnded,
}: {
  onSignedIn: (beforeOpen: (user: { name: string }) => Promise<void>) => Promise<void>;
  sessionEnded?: boolean;
}) => {
  const [view, setView] = useState<View>(initialView);
  const [identifier, setIdentifier] = useState("");
  const sso = runtimeConfig().sso;

  const finish = () =>
    onSignedIn(async (user) => {
      setView({ name: "done", who: user.name });
      await new Promise((r) => setTimeout(r, WELCOME_MS));
    });

  if (view.name === "reset") {
    return (
      <PasswordReset
        initialEmail={identifier.includes("@") ? identifier : ""}
        onBack={(notice) => setView({ name: "local", notice })}
      />
    );
  }

  return (
    <SignInLayout>
      {view.name === "sso" && (
        <SsoStep
          failed={view.failed}
          onLocal={() => setView({ name: "local" })}
          sessionEnded={sessionEnded}
        />
      )}
      {view.name === "local" && (
        <LocalStep
          identifier={identifier}
          notice={view.notice}
          onBack={sso ? () => setView({ failed: false, name: "sso" }) : undefined}
          onChallenge={(pendingId, factors) => setView({ factors, name: "code", pendingId })}
          onForgot={() => setView({ name: "reset" })}
          onIdentifier={setIdentifier}
          onSession={finish}
          sessionEnded={sessionEnded && !sso}
        />
      )}
      {view.name === "code" && (
        <CodeStep
          factors={view.factors}
          identifier={identifier}
          onRestart={() => setView(sso ? { failed: false, name: "sso" } : { name: "local" })}
          onVerified={finish}
          pendingId={view.pendingId}
        />
      )}
      {view.name === "done" && <Welcome who={view.who} />}
    </SignInLayout>
  );
};

const CodeStep = ({
  factors,
  identifier,
  onRestart,
  onVerified,
  pendingId,
}: {
  factors: SecondFactor[];
  identifier: string;
  onRestart: () => void;
  onVerified: () => Promise<void>;
  pendingId: string;
}) => {
  const codeFactors = factors.filter((f): f is "email" | "totp" => f === "totp" || f === "email");
  const offered = codeFactors.length > 0 ? codeFactors : (["totp"] as const);
  const [factor, setFactor] = useState<"email" | "totp">(offered[0] ?? "totp");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [wrong, setWrong] = useState(false);
  const [problem, setProblem] = useState<null | string>(null);
  const [emailState, setEmailState] = useState<"idle" | "sent" | "wait">("idle");
  const input = useRef<HTMLInputElement>(null);
  const canPasskey = factors.includes("passkey") && passkeysSupported();

  useEffect(() => {
    input.current?.focus();
  }, [factor]);

  const sendEmail = async () => {
    setProblem(null);
    try {
      setEmailState(await auth.sendLoginEmailCode(pendingId));
    } catch {
      setProblem("We couldn't send the email. Try again, or use your authenticator.");
    }
  };

  const pick = (f: "email" | "totp") => {
    setFactor(f);
    setCode("");
    setWrong(false);
    if (f === "email" && emailState === "idle") void sendEmail();
  };

  const verify = async (value = code) => {
    if (value.length < 6 || busy) return;
    setBusy(true);
    setWrong(false);
    setProblem(null);
    try {
      const ok = await auth.verifySecondFactor(pendingId, factor, value);
      if (ok) {
        await onVerified();
        return;
      }
      setWrong(true);
    } catch {
      setProblem("This sign-in has timed out. Start again from the first step.");
    }
    setBusy(false);
  };

  const passkey = async () => {
    setBusy(true);
    setProblem(null);
    try {
      const options = await auth.beginPasskeyLogin(pendingId);
      const credential = await getAssertion(options);
      if (await auth.verifySecondFactor(pendingId, "passkey", credential)) {
        await onVerified();
        return;
      }
      setProblem("That passkey wasn't accepted. Try another way.");
    } catch {
      setProblem("The passkey step didn't finish. Try again, or use a code.");
    }
    setBusy(false);
  };

  const ready = code.length === 6;
  const masked = maskEmail(identifier);
  return (
    <form
      className="flex flex-col gap-5"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void verify();
      }}
    >
      <SignInTitle
        body={
          factor === "email"
            ? "Enter the code we emailed you."
            : "Enter your authenticator or token code."
        }
        title="Enter your code"
      />
      {offered.length > 1 && (
        <Segmented
          label="Second factor"
          onChange={pick}
          options={[
            { label: "Authenticator", value: "totp" },
            { label: "Email", value: "email" },
          ]}
          value={factor}
        />
      )}
      {factor === "email" && emailState !== "idle" && (
        <Alert tone="info">
          {emailState === "wait"
            ? "A code was sent a moment ago. Wait a little, then ask for another."
            : `We emailed a code to ${masked ?? "the address on your account"}. It works for 10 minutes. `}
          <button
            className="font-bold text-primary hover:text-ink"
            onClick={() => void sendEmail()}
            type="button"
          >
            Resend code
          </button>
        </Alert>
      )}
      {problem && <Alert tone="danger">{problem}</Alert>}
      <CodeInput
        aria-describedby={wrong ? "code-wrong" : undefined}
        invalid={wrong}
        onChange={(v) => {
          setCode(v);
          setWrong(false);
        }}
        onComplete={(v) => void verify(v)}
        ref={input}
        value={code}
      />
      {wrong && (
        <span
          className="text-[0.875rem] leading-[1.3] font-bold text-danger"
          id="code-wrong"
          role="alert"
        >
          ✕ That code didn't work. Codes change every 30 seconds.
        </span>
      )}
      <Button
        aria-disabled={!ready || undefined}
        block
        className={ready || busy ? undefined : "bg-sunken text-muted hover:bg-sunken"}
        loading={busy}
        loadingLabel="Verifying…"
        size="lg"
        type="submit"
      >
        Verify &amp; sign in
      </Button>
      {canPasskey && (
        <Button
          block
          className="h-12"
          disabled={busy}
          onClick={() => void passkey()}
          variant="secondary"
        >
          <KeyRound aria-hidden />
          Use a passkey
        </Button>
      )}
      <Button className="self-center" disabled={busy} onClick={onRestart} variant="link">
        <ChevronLeft aria-hidden />
        Start again
      </Button>
    </form>
  );
};

const initialView = (): View => {
  const back = auth.readSsoReturn(globalThis.location.search);
  if (back) {
    globalThis.history.replaceState({}, "", globalThis.location.pathname);
    if (back.kind === "challenge") {
      return { factors: back.factors, name: "code", pendingId: back.pendingId };
    }
    log.warn("single sign-on came back with an error", { reason: back.reason });
    return { failed: true, name: "sso" };
  }
  return runtimeConfig().sso ? { failed: false, name: "sso" } : { name: "local" };
};

const LocalStep = ({
  identifier,
  notice,
  onBack,
  onChallenge,
  onForgot,
  onIdentifier,
  onSession,
  sessionEnded,
}: {
  identifier: string;
  notice?: "reset";
  onBack?: () => void;
  onChallenge: (pendingId: string, factors: SecondFactor[]) => void;
  onForgot: () => void;
  onIdentifier: (v: string) => void;
  onSession: () => Promise<void>;
  sessionEnded?: boolean;
}) => {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<"disabled" | "invalid" | "missing" | "offline" | null>(
    null,
  );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!identifier.trim() || !password) {
      setProblem("missing");
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      const r = await auth.login(identifier.trim(), password);
      if (r.kind === "rejected") {
        setProblem(r.reason);
        setBusy(false);
        return;
      }
      if (r.kind === "challenge") {
        onChallenge(r.pendingId, r.factors);
        return;
      }
      await onSession();
    } catch (error) {
      log.warn("password step failed", { offline: error instanceof NetworkError });
      setProblem("offline");
      setBusy(false);
    }
  };

  return (
    <form className="flex flex-col gap-5" noValidate onSubmit={submit}>
      <SignInTitle body="For accounts that don't use SSO." title="Local login" />
      {notice === "reset" && (
        <Alert title="Password reset" tone="ok">
          Sign in with your new password.
        </Alert>
      )}
      {sessionEnded && !problem && (
        <Alert title="You were signed out" tone="info">
          Your session ended. Sign in again to carry on.
        </Alert>
      )}
      {problem && (
        <Alert tone="danger">
          {problem === "invalid" && (
            <>
              <b>That didn't match.</b> Check your username and password, then try again.
            </>
          )}
          {problem === "missing" && (
            <>
              <b>Both fields are needed.</b> Enter your username or email and your password.
            </>
          )}
          {problem === "disabled" && (
            <>
              <b>This account is turned off.</b> Ask an admin to turn it back on.
            </>
          )}
          {problem === "offline" && (
            <>
              <b>Sign-in isn't answering.</b> Try again in a moment.
            </>
          )}
        </Alert>
      )}
      <Field label="Username or email">
        <Input
          autoComplete="username"
          autoFocus
          className="h-12 text-[1rem]"
          onChange={(e) => onIdentifier(e.target.value)}
          value={identifier}
        />
      </Field>
      <Field
        label="Password"
        labelAside={
          <button
            className="font-bold text-primary hover:text-ink"
            onClick={onForgot}
            type="button"
          >
            Forgot password?
          </button>
        }
      >
        <Input
          aria-invalid={problem === "invalid" || undefined}
          autoComplete="current-password"
          className="h-12 text-[1rem]"
          mono
          onChange={(e) => {
            setPassword(e.target.value);
            if (problem === "invalid") setProblem(null);
          }}
          type="password"
          value={password}
        />
      </Field>
      <Button block loading={busy} loadingLabel="Signing in…" size="lg" type="submit">
        Sign in
      </Button>
      {onBack && (
        <Button className="self-center" onClick={onBack} variant="link">
          <ChevronLeft aria-hidden />
          Back to SSO
        </Button>
      )}
    </form>
  );
};

const SsoStep = ({
  failed,
  onLocal,
  sessionEnded,
}: {
  failed: boolean;
  onLocal: () => void;
  sessionEnded?: boolean;
}) => {
  const [busy, setBusy] = useState(false);
  return (
    <>
      <SignInTitle
        body="Use your company account. You'll come straight back here."
        title="Sign in to continue"
      />
      {sessionEnded && !failed && (
        <Alert title="You were signed out" tone="info">
          Your session ended. Sign in again to carry on.
        </Alert>
      )}
      {failed && (
        <Alert title="SSO sign-in didn't finish" tone="danger">
          The identity provider returned an error. Try again, or use a local login.
        </Alert>
      )}
      <Button
        block
        loading={busy}
        loadingLabel="Redirecting…"
        onClick={() => {
          setBusy(true);
          log.info("starting single sign-on");
          globalThis.location.assign(auth.SSO_LOGIN_PATH);
        }}
        size="lg"
      >
        Sign in with SSO
      </Button>
      <Button className="self-center" onClick={onLocal} variant="link">
        Use local login instead
      </Button>
    </>
  );
};

const Welcome = ({ who }: { who: string }) => {
  return (
    <div className="flex flex-col items-start gap-4" role="status">
      <SneakerLoader delay={0} duration={1400} size={96} />
      <span className="font-display text-[2rem] leading-[1.1] font-bold tracking-[-0.02em]">
        Welcome back, {who}
      </span>
      <span className="text-[1rem] leading-[1.45] text-muted">Opening your vault…</span>
    </div>
  );
};
