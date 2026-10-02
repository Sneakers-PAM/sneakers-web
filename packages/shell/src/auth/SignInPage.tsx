import { getAssertion, passkeysSupported } from "@sneakers-web/api-client";
import { Alert, Button, CodeInput, Field, Input, Segmented, SneakerLoader } from "@sneakers-web/ui";
import { ChevronLeft, KeyRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  Form,
  Link,
  useActionData,
  useHref,
  useLoaderData,
  useNavigation,
  useSubmit,
} from "react-router";

import type { CodeFactor, SignInLoaderData, SignInState } from "#shell/server/signIn.server";

import { maskEmail } from "#shell/auth/mask";
import { SignInLayout, SignInTitle } from "#shell/gate/Frames";

const WELCOME_MS = 1400;

/**
 * Sign-in: single sign-on first (when the install has it), a local password login and the
 * second-factor step. Every step is a form posted to the route's action, so it works before
 * the page's scripts load; the gateway does the checks with Ory.
 */
export const SignInPage = () => {
  const loaded = useLoaderData<SignInLoaderData>();
  const acted = useActionData<SignInState>();
  const state = acted ?? loaded.state;
  return (
    <SignInLayout>
      {state.view === "sso" && (
        <SsoStep ended={loaded.ended} failed={!!state.failed} next={loaded.next} />
      )}
      {state.view === "local" && (
        <LocalStep
          ended={loaded.ended && !loaded.sso}
          next={loaded.next}
          sso={loaded.sso}
          state={state}
        />
      )}
      {state.view === "code" && <CodeStep key={state.pendingId} next={loaded.next} state={state} />}
      {state.view === "done" && <Welcome name={state.name} next={state.next} />}
    </SignInLayout>
  );
};

const Hidden = ({ name, value }: { name: string; value: string }) => (
  <input name={name} type="hidden" value={value} />
);

const useBusy = (intent: string) => {
  const navigation = useNavigation();
  return navigation.state !== "idle" && navigation.formData?.get("intent") === intent;
};

const EndedNotice = () => (
  <Alert title="You were signed out" tone="info">
    Your session ended. Sign in again to carry on.
  </Alert>
);

const SsoStep = ({ ended, failed, next }: { ended: boolean; failed: boolean; next: string }) => {
  const busy = useBusy("sso");
  return (
    <>
      <SignInTitle
        body="Use your company account. You'll come straight back here."
        title="Sign in to continue"
      />
      {ended && !failed && <EndedNotice />}
      {failed && (
        <Alert title="SSO sign-in didn't finish" tone="danger">
          The identity provider returned an error. Try again, or use a local login.
        </Alert>
      )}
      <Form className="flex flex-col" method="post">
        <Hidden name="next" value={next} />
        <Button
          block
          loading={busy}
          loadingLabel="Redirecting…"
          name="intent"
          size="lg"
          type="submit"
          value="sso"
        >
          Sign in with SSO
        </Button>
      </Form>
      <Button asChild className="self-center" variant="link">
        <Link to={`?view=local&next=${encodeURIComponent(next)}`}>Use local login instead</Link>
      </Button>
    </>
  );
};

const PROBLEMS = {
  disabled: (
    <>
      <b>This account is turned off.</b> Ask an admin to turn it back on.
    </>
  ),
  invalid: (
    <>
      <b>That didn&apos;t match.</b> Check your username and password, then try again.
    </>
  ),
  missing: (
    <>
      <b>Both fields are needed.</b> Enter your username or email and your password.
    </>
  ),
  offline: (
    <>
      <b>Sign-in isn&apos;t answering.</b> Try again in a moment.
    </>
  ),
};

const LocalStep = ({
  ended,
  next,
  sso,
  state,
}: {
  ended: boolean;
  next: string;
  sso: boolean;
  state: Extract<SignInState, { view: "local" }>;
}) => {
  const busy = useBusy("login");
  return (
    <Form className="flex flex-col gap-5" method="post" noValidate>
      <Hidden name="next" value={next} />
      <SignInTitle body="For accounts that don't use SSO." title="Local login" />
      {state.notice === "reset" && (
        <Alert title="Password reset" tone="ok">
          Sign in with your new password.
        </Alert>
      )}
      {ended && !state.problem && <EndedNotice />}
      {state.problem && <Alert tone="danger">{PROBLEMS[state.problem]}</Alert>}
      <Field label="Username or email">
        <Input
          autoComplete="username"
          className="h-12 text-[1rem]"
          defaultValue={state.identifier ?? ""}
          name="identifier"
        />
      </Field>
      <Field
        label="Password"
        labelAside={
          <Link className="font-bold" to={`reset?next=${encodeURIComponent(next)}`}>
            Forgot password?
          </Link>
        }
      >
        <Input
          aria-invalid={state.problem === "invalid" || undefined}
          autoComplete="current-password"
          className="h-12 text-[1rem]"
          mono
          name="password"
          type="password"
        />
      </Field>
      <Button
        block
        loading={busy}
        loadingLabel="Signing in…"
        name="intent"
        size="lg"
        type="submit"
        value="login"
      >
        Sign in
      </Button>
      {sso && (
        <Button asChild className="self-center" variant="link">
          <Link to={`?view=sso&next=${encodeURIComponent(next)}`}>
            <ChevronLeft aria-hidden />
            Back to SSO
          </Link>
        </Button>
      )}
    </Form>
  );
};

const CODE_PROBLEMS = {
  expired: "This sign-in has timed out. Start again from the first step.",
  passkey: "The passkey step didn't finish. Try again, or use a code.",
  send: "We couldn't send the email. Try again, or use your authenticator.",
};

const CodeStep = ({
  next,
  state,
}: {
  next: string;
  state: Extract<SignInState, { view: "code" }>;
}) => {
  const submit = useSubmit();
  const form = useRef<HTMLFormElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [factor, setFactor] = useState<CodeFactor>(state.factor);
  // The typed code belongs to the server answer it was typed against; a new answer (a wrong
  // code, a resent email) starts the field empty again.
  const [typed, setTyped] = useState<{ code: string; for: typeof state }>({ code: "", for: state });
  const code = typed.for === state ? typed.code : "";
  const setCode = (next: string) => setTyped({ code: next, for: state });
  const busy = useBusy("verify");
  const offered = state.factors.filter((f): f is CodeFactor => f === "totp" || f === "email");
  const tabs: CodeFactor[] = offered.length > 0 ? offered : ["totp"];
  const canPasskey = state.factors.includes("passkey") && passkeysSupported();
  const masked = maskEmail(state.identifier);
  const carry = {
    factor,
    factors: state.factors.join(","),
    identifier: state.identifier,
    next,
    pendingId: state.pendingId,
  };

  useEffect(() => {
    input.current?.focus();
  }, [factor, state.wrong]);

  useEffect(() => {
    if (!state.passkeyOptions) return;
    void getAssertion(state.passkeyOptions)
      .then((credential) =>
        submit({ ...carry, credential, intent: "passkey-verify" }, { method: "post" }),
      )
      .catch(() => submit({ ...carry, intent: "passkey-cancelled" }, { method: "post" }));
    // Run once per set of passkey options the server hands back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.passkeyOptions]);

  const pick = (f: CodeFactor) => {
    setFactor(f);
    setCode("");
    if (f === "email" && !state.emailState)
      void submit({ ...carry, factor: "email", intent: "email" }, { method: "post" });
  };

  const ready = code.length === 6;
  return (
    <Form className="flex flex-col gap-5" method="post" noValidate ref={form}>
      {Object.entries(carry).map(([k, v]) => (
        <Hidden key={k} name={k} value={v} />
      ))}
      <SignInTitle
        body={
          factor === "email"
            ? "Enter the code we emailed you."
            : "Enter your authenticator or token code."
        }
        title="Enter your code"
      />
      {tabs.length > 1 && (
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
      {factor === "email" && (
        <Alert tone="info">
          {state.emailState === "wait"
            ? "A code was sent a moment ago. Wait a little, then ask for another. "
            : state.emailState === "sent"
              ? `We emailed a code to ${masked ?? "the address on your account"}. It works for 10 minutes. `
              : "Ask for a code and we'll email it to the address on your account. "}
          <button
            className="font-bold text-primary hover:text-ink"
            name="intent"
            type="submit"
            value="email"
          >
            {state.emailState ? "Resend code" : "Send code"}
          </button>
        </Alert>
      )}
      {state.problem && <Alert tone="danger">{CODE_PROBLEMS[state.problem]}</Alert>}
      <CodeInput
        aria-describedby={state.wrong ? "code-wrong" : undefined}
        invalid={state.wrong && code.length === 0}
        name="code"
        onChange={setCode}
        onComplete={() =>
          form.current?.requestSubmit(
            form.current.querySelector<HTMLButtonElement>("[value=verify]"),
          )
        }
        ref={input}
        value={code}
      />
      {state.wrong && code.length === 0 && (
        <span
          className="text-[0.875rem] leading-[1.3] font-bold text-danger"
          id="code-wrong"
          role="alert"
        >
          ✕ That code didn&apos;t work. Codes change every 30 seconds.
        </span>
      )}
      <Button
        block
        className={ready || busy ? undefined : "bg-sunken text-muted hover:bg-sunken"}
        loading={busy}
        loadingLabel="Verifying…"
        name="intent"
        size="lg"
        type="submit"
        value="verify"
      >
        Verify &amp; sign in
      </Button>
      {canPasskey && (
        <Button
          block
          className="h-12"
          name="intent"
          type="submit"
          value="passkey-begin"
          variant="secondary"
        >
          <KeyRound aria-hidden />
          Use a passkey
        </Button>
      )}
      <Button asChild className="self-center" variant="link">
        <Link to={`?next=${encodeURIComponent(next)}`}>
          <ChevronLeft aria-hidden />
          Start again
        </Link>
      </Button>
    </Form>
  );
};

const Welcome = ({ name, next }: { name: string; next: string }) => {
  // A full load, so the frame's loaders run with the new session cookie.
  const href = useHref(next);
  useEffect(() => {
    const t = setTimeout(() => globalThis.location.replace(href), WELCOME_MS);
    return () => clearTimeout(t);
  }, [href]);
  return (
    <div className="flex flex-col items-start gap-4" role="status">
      <noscript>
        <meta content={`1;url=${href}`} httpEquiv="refresh" />
      </noscript>
      <SneakerLoader delay={0} duration={WELCOME_MS} size={96} />
      <span className="font-display text-[2rem] leading-[1.1] font-bold tracking-[-0.02em]">
        {name ? `Welcome back, ${name}` : "Welcome back"}
      </span>
      <span className="text-[1rem] leading-[1.45] text-muted">Opening your vault…</span>
    </div>
  );
};
