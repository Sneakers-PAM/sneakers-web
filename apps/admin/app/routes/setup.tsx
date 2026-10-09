import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import {
  bootstrapAdmin,
  confirmEmailCode,
  createLogger,
  requestEmailCode,
  seedBuiltins,
  type SetupProblem,
} from "@sneakers-web/api-client";
import { CenteredFrame } from "@sneakers-web/shell";
import { gatewayFor, needsSetup } from "@sneakers-web/shell/server";
import { Alert, Button, cn, CodeInput, Field, Input, Mark } from "@sneakers-web/ui";
import { Check, X } from "lucide-react";
import { useRef, useState } from "react";
import { data, Form, Link, redirect, useActionData, useNavigation, useSubmit } from "react-router";

const log = createLogger("setup");

/** Setup is only for an install with no administrator. After that it's the sign-in page. */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  if (!(await needsSetup(request))) throw redirect("/sign-in");
  return null;
};

/**
 * Once the admin exists the loader would send this page to sign-in, so the wizard's own
 * steps (verify, ready) must not re-run it.
 */
export const shouldRevalidate = () => false;

export const PASSWORD_MIN = 12;

export type SetupState =
  | {
      email: string;
      seeded: { connections: number; folders: number; types: number };
      sent?: boolean;
      userId: string;
      username: string;
      view: "verify";
      wrong?: boolean;
    }
  | { fields: Fields; problem?: "invalid" | SetupProblem; view: "form" }
  | { problem?: SetupProblem; userId: string; username: string; view: "seed" }
  | { username: string; verified: boolean; view: "ready" };

type Fields = { email: string; name: string; username: string };

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

export const action = async ({ request }: ActionFunctionArgs) => {
  const gw = gatewayFor(request);
  const form = await request.formData();
  const intent = text(form, "intent");
  const userId = text(form, "userId");
  const username = text(form, "username");

  // Create the admin, then install the built-ins straight away, so the setup token is
  // used inside this one request and never sent back to the browser.
  if (intent === "create" || intent === "seed") {
    const setupToken = text(form, "setupToken");
    let id = userId;
    if (intent === "create") {
      const fields: Fields = { email: text(form, "email"), name: text(form, "name"), username };
      const password = String(form.get("password") ?? "");
      if (
        !fields.username ||
        !fields.email ||
        !fields.name ||
        password.length < PASSWORD_MIN ||
        password !== String(form.get("confirm") ?? "") ||
        !setupToken
      )
        return data<SetupState>({ fields, problem: "invalid", view: "form" }, { status: 400 });
      const made = await bootstrapAdmin(gw, setupToken, { ...fields, password });
      if (!made.ok) {
        log.warn("first admin refused", { problem: made.problem });
        return data<SetupState>({ fields, problem: made.problem, view: "form" }, { status: 400 });
      }
      log.info("first admin created", { userId: made.userId });
      id = made.userId;
    }
    const seeded = await seedBuiltins(gw, setupToken, id);
    if (!seeded.ok) {
      log.warn("seeding the built-ins failed", { problem: seeded.problem, userId: id });
      return data<SetupState>({ problem: seeded.problem, userId: id, username, view: "seed" });
    }
    const email = text(form, "email");
    await requestEmailCode(gw, id).catch(() =>
      log.warn("verification email not sent", { userId: id }),
    );
    return data<SetupState>({ email, seeded, userId: id, username, view: "verify" });
  }

  const verifying = {
    email: text(form, "email"),
    seeded: JSON.parse(text(form, "seeded") || "{}") as {
      connections: number;
      folders: number;
      types: number;
    },
    userId,
    username,
    view: "verify" as const,
  };
  if (intent === "resend") {
    await requestEmailCode(gw, userId);
    return data<SetupState>({ ...verifying, sent: true });
  }
  if (intent === "verify") {
    const good = await confirmEmailCode(gw, userId, text(form, "code").replaceAll(/\D/g, ""));
    return good
      ? data<SetupState>({ username, verified: true, view: "ready" })
      : data<SetupState>({ ...verifying, wrong: true });
  }
  if (intent === "skip") return data<SetupState>({ username, verified: false, view: "ready" });
  return data<SetupState>(
    { fields: { email: "", name: "", username: "" }, view: "form" },
    { status: 400 },
  );
};

export const meta = () => [{ title: "Set up Sneakers-PAM" }];

const STEPS = ["Check", "Create admin", "Install", "Verify email", "Ready"];

/**
 * The setup wizard's progress line: a numbered circle per step with a connecting bar between
 * them, never the step names in flowing text, so it stays on one line at every width instead of
 * wrapping its last step onto a second one (issue #241). The name is read to screen readers.
 */
const Steps = ({ at }: { at: number }) => (
  <ol aria-label="Setup steps" className="m-0 flex list-none items-center gap-1 p-0">
    {STEPS.map((s, index) => {
      const number = index + 1;
      const done = index < at;
      const current = index === at;
      return (
        <li
          aria-current={current ? "step" : undefined}
          className="flex flex-1 items-center gap-1 last:flex-none"
          key={s}
        >
          <span
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-full text-[0.75rem] font-bold",
              done && "bg-ok text-on-primary",
              current && "bg-primary text-on-primary",
              !done && !current && "bg-sunken text-muted",
            )}
          >
            {done ? <Check aria-hidden className="size-3.5" strokeWidth={3} /> : number}
            <span className="sr-only">{`: ${s}${done ? ", done" : ""}`}</span>
          </span>
          {number < STEPS.length && (
            <span
              aria-hidden
              className={cn("h-0.5 flex-1 rounded-full", done ? "bg-ok" : "bg-border")}
            />
          )}
        </li>
      );
    })}
  </ol>
);

const TOKEN_PROBLEMS: Record<string, { body: string; title: string }> = {
  "bad-token": {
    body: "It may have been used already, or the server restarted with a new one.",
    title: "That setup token is not valid",
  },
  done: { body: "An administrator already exists. Sign in instead.", title: "Already set up" },
  invalid: {
    body: "Fill in every field, with matching passwords.",
    title: "Some details are missing",
  },
  missing: {
    body: "Username, email and password are all required.",
    title: "Some details are missing",
  },
  "not-enabled": {
    body: "The server has no SETUP_TOKEN configured. Whoever runs it needs to set one.",
    title: "Setup isn't enabled on this server",
  },
  unavailable: {
    body: "A service behind the gateway isn't answering. Try again in a moment.",
    title: "Couldn't reach the server",
  },
};

const CreateAdmin = ({ state }: { state?: Extract<SetupState, { view: "form" }> }) => {
  const busy = useNavigation().state === "submitting";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const short = password.length > 0 && password.length < PASSWORD_MIN;
  const mismatch = confirm.length > 0 && confirm !== password;
  const f = state?.fields;
  const problem = state?.problem ? TOKEN_PROBLEMS[state.problem] : undefined;
  return (
    <Form className="flex flex-col gap-4" method="post">
      <input name="intent" type="hidden" value="create" />
      <div className="flex flex-col gap-1.5">
        <h1 className="m-0 font-display text-[1.5rem] font-bold">Set up Sneakers-PAM</h1>
        <p className="m-0 text-muted">
          Create the first admin. This account becomes the protected root admin.
        </p>
      </div>
      <div className="grid gap-4 tablet:grid-cols-2">
        <Field label="Username" required>
          <Input
            autoCapitalize="none"
            autoComplete="username"
            defaultValue={f?.username}
            mono
            name="username"
            spellCheck={false}
          />
        </Field>
        <Field label="Display name" required>
          <Input autoComplete="name" defaultValue={f?.name} name="name" />
        </Field>
      </div>
      <Field label="Email" required>
        <Input autoComplete="email" defaultValue={f?.email} name="email" type="email" />
      </Field>
      <div className="grid gap-4 tablet:grid-cols-2">
        <Field
          error={short ? `At least ${PASSWORD_MIN} characters.` : undefined}
          label="Password"
          required
        >
          <Input
            autoComplete="new-password"
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            value={password}
          />
        </Field>
        <Field error={mismatch ? "Doesn't match." : undefined} label="Confirm password" required>
          <Input
            autoComplete="new-password"
            name="confirm"
            onChange={(event) => setConfirm(event.target.value)}
            type="password"
            value={confirm}
          />
        </Field>
      </div>
      <Field
        hint="One-time value from whoever runs the server. Check the server log."
        label="Setup token"
        required
      >
        <Input autoComplete="off" mono name="setupToken" spellCheck={false} />
      </Field>
      {problem && (
        <Alert role="alert" title={problem.title} tone="danger">
          {problem.body}
          {state?.problem === "done" && (
            <>
              {" "}
              <Link className="font-bold" to="/sign-in">
                Go to sign-in
              </Link>
            </>
          )}
        </Alert>
      )}
      <Button
        block
        disabled={short || mismatch}
        loading={busy}
        loadingLabel="Creating…"
        size="lg"
        type="submit"
      >
        Create admin
      </Button>
    </Form>
  );
};

const Installing = ({ state }: { state: Extract<SetupState, { view: "seed" }> }) => {
  const busy = useNavigation().state === "submitting";
  return (
    <Form className="flex flex-col gap-4" method="post">
      <input name="intent" type="hidden" value="seed" />
      <input name="userId" type="hidden" value={state.userId} />
      <input name="username" type="hidden" value={state.username} />
      <h1 className="m-0 font-display text-[1.5rem] font-bold">Finish setup</h1>
      <Alert role="alert" title="The admin exists, but the built-ins didn't install" tone="warn">
        {TOKEN_PROBLEMS[state.problem ?? "unavailable"]?.body} Enter the setup token again to retry;
        it&apos;s safe to run twice.
      </Alert>
      <Field label="Setup token" required>
        <Input autoComplete="off" mono name="setupToken" spellCheck={false} />
      </Field>
      <Button block loading={busy} loadingLabel="Installing…" size="lg" type="submit">
        Install built-ins
      </Button>
    </Form>
  );
};

const Verify = ({ state }: { state: Extract<SetupState, { view: "verify" }> }) => {
  const submit = useSubmit();
  const busy = useNavigation().state === "submitting";
  const [typed, setTyped] = useState<{ code: string; for: unknown }>({ code: "", for: undefined });
  const wrong = !!state.wrong && typed.for !== state;
  const carry = {
    email: state.email,
    seeded: JSON.stringify(state.seeded),
    userId: state.userId,
    username: state.username,
  };
  const form = useRef<HTMLFormElement>(null);
  return (
    <Form className="flex flex-col gap-4" method="post" ref={form}>
      {Object.entries(carry).map(([k, v]) => (
        <input key={k} name={k} type="hidden" value={v} />
      ))}
      <Alert title="Built-ins installed" tone="ok">
        {state.seeded.types} secret types, {state.seeded.connections} connections and{" "}
        {state.seeded.folders} folders, with the default password policy and security settings.
      </Alert>
      <div className="flex flex-col gap-1.5">
        <h1 className="m-0 font-display text-[1.5rem] font-bold">Verify your email</h1>
        <p className="m-0 text-muted">
          Enter the 6-digit code sent to {state.email || "your email"} for{" "}
          <b className="text-ink">{state.username}</b>.
        </p>
      </div>
      <CodeInput
        aria-describedby={wrong ? "setup-wrong" : undefined}
        invalid={wrong}
        name="code"
        onChange={(code) => setTyped({ code, for: state })}
        onComplete={(code) => void submit({ ...carry, code, intent: "verify" }, { method: "post" })}
        size="md"
        value={typed.code}
      />
      {wrong && (
        <span className="text-[0.875rem] font-bold text-danger" id="setup-wrong" role="alert">
          <X aria-hidden className="mr-1 inline size-3.5 align-[-2px]" strokeWidth={3} />
          That code is wrong or has expired. Send a new one and try again.
        </span>
      )}
      <span className="text-small text-muted">
        {state.sent ? "A new code is on its way. " : "Didn't get it? "}
        <button
          className="font-bold text-primary hover:text-ink"
          name="intent"
          type="submit"
          value="resend"
        >
          Resend code
        </button>
      </span>
      <Button
        block
        disabled={typed.code.length !== 6}
        loading={busy}
        loadingLabel="Verifying…"
        name="intent"
        size="lg"
        type="submit"
        value="verify"
      >
        Verify
      </Button>
      <button
        className="self-center text-small font-bold text-muted hover:text-ink"
        name="intent"
        type="submit"
        value="skip"
      >
        Skip for now; verify later from the user page
      </button>
    </Form>
  );
};

const Ready = ({ state }: { state: Extract<SetupState, { view: "ready" }> }) => (
  <div className="flex flex-col items-center gap-4 text-center">
    <Mark hole="var(--color-surface)" size={96} />
    <h1 className="m-0 font-display text-[1.5rem] font-bold">You&apos;re all set</h1>
    <p className="m-0 text-muted">
      Sign in as <b className="text-ink">{state.username}</b> to open the admin console. Then add
      people and your first shared folder.
      {!state.verified && " Your email isn't verified yet; you can do it from your user page."}
    </p>
    <Button asChild block size="lg">
      <Link reloadDocument to="/sign-in">
        Continue to sign-in
      </Link>
    </Button>
  </div>
);

const STEP_OF: Record<SetupState["view"], number> = { form: 1, ready: 4, seed: 2, verify: 3 };

const Setup = () => {
  const state = useActionData<typeof action>();
  const view = state?.view ?? "form";
  return (
    <CenteredFrame>
      <div className="flex flex-col gap-5">
        <Steps at={STEP_OF[view]} />
        {view === "form" && (
          <CreateAdmin
            key={JSON.stringify(state ?? {})}
            state={state?.view === "form" ? state : undefined}
          />
        )}
        {state?.view === "seed" && <Installing state={state} />}
        {state?.view === "verify" && (
          <Verify key={String(state.wrong) + String(state.sent)} state={state} />
        )}
        {state?.view === "ready" && <Ready state={state} />}
      </div>
    </CenteredFrame>
  );
};

export default Setup;
