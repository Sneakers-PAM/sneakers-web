import type { ActionFunctionArgs } from "react-router";

import { AdminCreateServiceAccountDocument } from "@sneakers-web/api-client";
import { type Refusal, refusalMessage, refusalOf } from "@sneakers-web/shell";
import { guard, requireUser } from "@sneakers-web/shell/server";
import { Alert, Button, Field, Input, PageHeader, Textarea } from "@sneakers-web/ui";
import { data, Form, Link, redirect, useActionData, useNavigation } from "react-router";

import { Panel } from "@/components/Admin";
import { PageError } from "@/components/PageError";
import { text } from "@/lib/admin.server";

interface NewState {
  description: string;
  name: string;
  problem?: "missing";
  refusal?: Refusal;
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { gw } = await requireUser(request);
  const form = await request.formData();
  const fields = { description: text(form, "description"), name: text(form, "name") };
  if (!fields.name) return data<NewState>({ ...fields, problem: "missing" }, { status: 400 });
  return guard(request, async () => {
    try {
      const r = await gw.gql(AdminCreateServiceAccountDocument, fields);
      throw redirect(`/service-accounts/${r.createServiceAccount.id}`);
    } catch (error) {
      const refusal = refusalOf(error);
      if (!refusal) throw error;
      return data<NewState>({ ...fields, refusal }, { status: 400 });
    }
  });
};

export const meta = () => [{ title: "New service account · Sneakers-PAM admin console" }];

const NewServiceAccount = () => {
  const state = useActionData<typeof action>();
  const busy = useNavigation().state === "submitting";
  return (
    <Form className="flex flex-col gap-6" method="post">
      <PageHeader
        actions={
          <>
            <Button asChild variant="secondary">
              <Link to="/service-accounts">Cancel</Link>
            </Button>
            <Button loading={busy} loadingLabel="Creating…" type="submit">
              Create service account
            </Button>
          </>
        }
        eyebrow="Access · Service accounts"
        subtitle="Mint its first API token, or link an OIDC client, on the next page."
        title="New service account"
      />
      {state?.refusal && (
        <Alert title="Couldn't create the service account" tone="danger">
          {refusalMessage(state.refusal)}
        </Alert>
      )}
      <Panel className="max-w-[40rem]" title="Details">
        <Field
          error={state?.problem === "missing" ? "Give it a name." : undefined}
          label="Name"
          required
        >
          <Input
            autoComplete="off"
            defaultValue={state?.name}
            name="name"
            placeholder="e.g. CI Pipeline"
          />
        </Field>
        <Field hint="What it's for and who owns it. It can't be changed later." label="Description">
          <Textarea defaultValue={state?.description} name="description" />
        </Field>
      </Panel>
    </Form>
  );
};

export default NewServiceAccount;

export const ErrorBoundary = () => (
  <PageError back="/service-accounts" backLabel="Back to service accounts" />
);
