import { Alert, Button, CodeInput, Field, Input } from "@sneakers-web/ui";
import { ChevronLeft } from "lucide-react";
import { useState } from "react";
import { Form, Link, useActionData, useNavigation, useSearchParams } from "react-router";

import type { ResetState } from "#shell/server/signIn.server";

import { maskEmail } from "#shell/auth/mask";
import { CenteredFrame, FrameTitle } from "#shell/gate/Frames";

/** Matches the gateway's check; the server repeats it. */
const MIN_LENGTH = 8;

const CONFIRM_PROBLEMS = {
  invalid_code: {
    body: "It may have expired. Ask for a new one and try again.",
    title: "That code didn't work",
  },
  unavailable: {
    body: "Try again in a minute. If it keeps failing, ask an admin.",
    title: "Reset isn't available right now",
  },
  weak_password: {
    body: `Use at least ${MIN_LENGTH} characters.`,
    title: "Pick a stronger password",
  },
};

/** Self-service password reset: an emailed code, then a new password. */
export const ResetPage = () => {
  const state = useActionData<ResetState>() ?? { email: "", step: "request" as const };
  const [search] = useSearchParams();
  const back = `..?view=local&next=${encodeURIComponent(search.get("next") ?? "")}`;
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";
  const [code, setCode] = useState("");

  if (state.step === "request") {
    return (
      <CenteredFrame>
        <Form className="flex flex-col gap-4.5" method="post" noValidate>
          <input name="intent" type="hidden" value="request" />
          <FrameTitle body="We'll email you a code." title="Reset your password" />
          <Field
            error={state.problem === "missing" ? "Enter the email on your account." : undefined}
            label="Email"
          >
            <Input autoComplete="email" defaultValue={state.email} name="email" type="email" />
          </Field>
          <Button block loading={busy} loadingLabel="Sending…" size="lg" type="submit">
            Send reset code
          </Button>
          {state.problem === "send" && (
            <Alert title="Couldn't send the email" tone="danger">
              Try again in a minute. If it keeps failing, ask an admin.
            </Alert>
          )}
          <Button asChild className="self-start" variant="link">
            <Link relative="path" to={back}>
              <ChevronLeft aria-hidden />
              Back to sign-in
            </Link>
          </Button>
        </Form>
      </CenteredFrame>
    );
  }

  const problem =
    state.problem && state.problem in CONFIRM_PROBLEMS
      ? CONFIRM_PROBLEMS[state.problem as keyof typeof CONFIRM_PROBLEMS]
      : null;
  return (
    <CenteredFrame>
      <Form className="flex flex-col gap-4.5" method="post" noValidate>
        <input name="intent" type="hidden" value="confirm" />
        <input name="email" type="hidden" value={state.email} />
        <FrameTitle
          body={`We sent a code to ${maskEmail(state.email) ?? "your email"}.`}
          title="Check your email"
        />
        {problem && (
          <Alert title={problem.title} tone="danger">
            {problem.body}
          </Alert>
        )}
        <Field label="Code from the email">
          <CodeInput
            label="Code from the email"
            name="code"
            onChange={setCode}
            size="md"
            value={code}
          />
        </Field>
        <Field
          error={state.problem === "short" ? `Use at least ${MIN_LENGTH} characters.` : undefined}
          hint={`At least ${MIN_LENGTH} characters.`}
          label="New password"
        >
          <Input autoComplete="new-password" mono name="password" type="password" />
        </Field>
        <Field
          error={state.problem === "mismatch" ? "Passwords don't match." : undefined}
          label="Confirm password"
        >
          <Input autoComplete="new-password" mono name="confirm" type="password" />
        </Field>
        <Button block loading={busy} loadingLabel="Resetting…" size="lg" type="submit">
          Reset password
        </Button>
        <div className="flex justify-between">
          <Button asChild variant="link">
            <Link to=".">Send a new code</Link>
          </Button>
          <Button asChild variant="link">
            <Link relative="path" to={back}>
              Back to sign-in
            </Link>
          </Button>
        </div>
      </Form>
    </CenteredFrame>
  );
};
