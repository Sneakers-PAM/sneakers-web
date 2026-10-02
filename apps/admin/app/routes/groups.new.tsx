import type { ActionFunctionArgs } from "react-router";

import { AdminCreateGroupDocument } from "@sneakers-web/api-client";
import { type Refusal, refusalMessage, refusalOf } from "@sneakers-web/shell";
import { guard, requireUser } from "@sneakers-web/shell/server";
import { Alert, Button, Field, Input, PageHeader } from "@sneakers-web/ui";
import { data, Form, Link, redirect, useActionData, useNavigation } from "react-router";

import { Panel } from "@/components/Admin";
import { PageError } from "@/components/PageError";
import { text } from "@/lib/admin.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { gw } = await requireUser(request);
  const name = text(await request.formData(), "name");
  if (!name)
    return data<{ name: string; problem?: "missing"; refusal?: Refusal }>(
      { name, problem: "missing" },
      { status: 400 },
    );
  return guard(request, async () => {
    try {
      const r = await gw.gql(AdminCreateGroupDocument, { name });
      throw redirect(`/groups/${r.createGroup.id}`);
    } catch (error) {
      const refusal = refusalOf(error);
      if (!refusal) throw error;
      return data<{ name: string; problem?: "missing"; refusal?: Refusal }>(
        { name, refusal },
        { status: 400 },
      );
    }
  });
};

export const meta = () => [{ title: "New group · Sneakers-PAM admin console" }];

const NewGroup = () => {
  const state = useActionData<typeof action>();
  const busy = useNavigation().state === "submitting";
  return (
    <Form className="flex flex-col gap-6" method="post">
      <PageHeader
        actions={
          <>
            <Button asChild variant="secondary">
              <Link to="/groups">Cancel</Link>
            </Button>
            <Button loading={busy} loadingLabel="Creating…" type="submit">
              Create group
            </Button>
          </>
        }
        eyebrow="Access · Groups"
        subtitle="Add members from the group's page once it exists."
        title="New group"
      />
      {state?.refusal && (
        <Alert title="Couldn't create the group" tone="danger">
          {refusalMessage(state.refusal)}
        </Alert>
      )}
      <Panel className="max-w-[35rem]" title="Group">
        <Field
          error={state?.problem === "missing" ? "Give the group a name." : undefined}
          hint="Names are unique, ignoring case."
          label="Name"
          required
        >
          <Input autoComplete="off" defaultValue={state?.name} name="name" />
        </Field>
      </Panel>
    </Form>
  );
};

export default NewGroup;

export const ErrorBoundary = () => <PageError back="/groups" backLabel="Back to groups" />;
