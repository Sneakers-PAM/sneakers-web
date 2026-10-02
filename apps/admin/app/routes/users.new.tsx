import type { ActionFunctionArgs } from "react-router";

import { AdminCreateLocalUserDocument } from "@sneakers-web/api-client";
import { type Refusal, refusalMessage, refusalOf } from "@sneakers-web/shell";
import { guard, requireUser } from "@sneakers-web/shell/server";
import { Alert, Button, Field, Input, PageHeader, toast } from "@sneakers-web/ui";
import { Copy, Eye, EyeOff, RefreshCw } from "lucide-react";
import { useState } from "react";
import {
  data,
  Form,
  Link,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
} from "react-router";

import { Panel } from "@/components/Admin";
import { PageError } from "@/components/PageError";
import { text } from "@/lib/admin.server";
import { randomPassword } from "@/lib/password";

export const loader = () => ({ password: randomPassword() });

interface NewUserState {
  email: string;
  name: string;
  problem?: "missing";
  refusal?: Refusal;
  username: string;
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { gw } = await requireUser(request);
  const form = await request.formData();
  const fields = {
    email: text(form, "email"),
    name: text(form, "name"),
    username: text(form, "username"),
  };
  const password = String(form.get("password") ?? "");
  if (!fields.email || !fields.name || !fields.username || !password)
    return data<NewUserState>({ ...fields, problem: "missing" }, { status: 400 });
  return guard(request, async () => {
    try {
      const r = await gw.gql(AdminCreateLocalUserDocument, { ...fields, password });
      throw redirect(`/users/${r.createLocalUser.id}/verify?created=1`);
    } catch (error) {
      const refusal = refusalOf(error);
      if (!refusal) throw error;
      return data<NewUserState>({ ...fields, refusal }, { status: 400 });
    }
  });
};

export const meta = () => [{ title: "New user · Sneakers-PAM admin console" }];

const NewUser = () => {
  const { password: first } = useLoaderData<typeof loader>();
  const state = useActionData<typeof action>();
  const busy = useNavigation().state === "submitting";
  const [password, setPassword] = useState(first);
  const [shown, setShown] = useState(true);
  const [name, setName] = useState(state?.name ?? "");
  const missing = state?.problem === "missing";
  const need = (v: string | undefined) => (missing && !v ? "Required." : undefined);

  return (
    <Form className="flex flex-col gap-6" method="post">
      <PageHeader
        actions={
          <>
            <Button asChild variant="secondary">
              <Link to="/users">Cancel</Link>
            </Button>
            <Button loading={busy} loadingLabel="Creating…" type="submit">
              Create user
            </Button>
          </>
        }
        eyebrow="Access · Users"
        subtitle="They get an email to verify their address."
        title="New user"
      />
      {state?.refusal && (
        <Alert title="Couldn't create the user" tone="danger">
          {refusalMessage(state.refusal)}
        </Alert>
      )}
      <div className="grid gap-5 desktop:grid-cols-2">
        <Panel title="Account">
          <Field error={need(state?.name)} label="Display name" required>
            <Input
              autoComplete="off"
              defaultValue={state?.name}
              name="name"
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <Field
            error={need(state?.username)}
            hint="Their sign-in name. Lowercase, no spaces."
            label="Username"
            required
          >
            <Input
              autoCapitalize="none"
              autoComplete="off"
              defaultValue={state?.username}
              mono
              name="username"
              spellCheck={false}
            />
          </Field>
          <Field error={need(state?.email)} label="Email" required>
            <Input autoComplete="off" defaultValue={state?.email} name="email" type="email" />
          </Field>
        </Panel>
        <Panel title="Initial password">
          <input name="password" type="hidden" value={password} />
          <output
            aria-label="Generated password"
            className="flex h-13 items-center rounded-md border-2 border-primary bg-reveal px-4 font-mono text-[1.25rem] font-medium tracking-[0.04em]"
          >
            {shown ? password : "•".repeat(password.length)}
          </output>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setShown((v) => !v)} size="sm" variant="secondary">
              {shown ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
              {shown ? "Hide" : "Show"}
            </Button>
            <Button
              onClick={() =>
                void navigator.clipboard
                  .writeText(password)
                  .then(() => toast("Password copied"))
                  .catch(() => toast.error("Couldn't copy. Select it and copy by hand."))
              }
              size="sm"
              variant="secondary"
            >
              <Copy aria-hidden />
              Copy
            </Button>
            <Button onClick={() => setPassword(randomPassword())} size="sm" variant="secondary">
              <RefreshCw aria-hidden />
              Regenerate
            </Button>
          </div>
          <Alert title="Share it securely" tone="warn">
            It isn&apos;t shown again. {name.trim() || "They"} must change it at first sign-in.
          </Alert>
        </Panel>
      </div>
    </Form>
  );
};

export default NewUser;

export const ErrorBoundary = () => <PageError back="/users" backLabel="Back to users" />;
