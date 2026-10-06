import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import {
  AdminDeletePasswordPolicyDocument,
  AdminPoliciesDocument,
  AdminUpdateSecuritySettingsDocument,
  type SecuritySettingsInput,
} from "@sneakers-web/api-client";
import {
  Badge,
  Button,
  Card,
  Field,
  PageHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  Tooltip,
} from "@sneakers-web/ui";
import { Plus } from "lucide-react";
import { Link, useFetcher, useLoaderData } from "react-router";

import { Choice, Panel, useResultToast } from "@/components/Admin";
import { PageError } from "@/components/PageError";
import { adminAct, adminLoad, text } from "@/lib/admin.server";
import { classChips } from "@/lib/policy";

export const loader = ({ request }: LoaderFunctionArgs) =>
  adminLoad(request, async (gw) => {
    const d = await gw.gql(AdminPoliciesDocument);
    return {
      policies: d.passwordPolicies.toSorted((a, b) => a.name.localeCompare(b.name)),
      security: d.securitySettings,
    };
  });

export const action = async ({ request }: ActionFunctionArgs) => {
  const form = await request.formData();
  const intent = text(form, "intent");
  return adminAct(request, intent, async (gw) => {
    if (intent === "delete-policy") {
      await gw.gql(AdminDeletePasswordPolicyDocument, { id: text(form, "id") });
      return `Deleted ${text(form, "name")}.`;
    }
    const input: SecuritySettingsInput = { defaultPasswordPolicyId: text(form, "policyId") };
    await gw.gql(AdminUpdateSecuritySettingsDocument, { input });
    return "Saved · default policy.";
  });
};

export const meta = () => [{ title: "Password policies · Sneakers-PAM admin console" }];

const Policies = () => {
  const { policies, security } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  useResultToast(fetcher.data);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        actions={
          <Button asChild>
            <Link to="/policies/new">
              <Plus aria-hidden />
              New policy
            </Link>
          </Button>
        }
        eyebrow="Configuration · Policies"
        subtitle="Rules for generating and checking passwords."
        title="Password policies"
      />
      <div className="flex flex-col gap-2">
        <Card>
          <Table>
            <TableHead>
              <tr>
                <TableHeaderCell>Name</TableHeaderCell>
                <TableHeaderCell>Length</TableHeaderCell>
                <TableHeaderCell>Complexity</TableHeaderCell>
                <TableHeaderCell>Rotation</TableHeaderCell>
                <TableHeaderCell>In use</TableHeaderCell>
                <TableHeaderCell>
                  <span className="sr-only">Actions</span>
                </TableHeaderCell>
              </tr>
            </TableHead>
            <TableBody>
              {policies.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <span className="flex items-center gap-2 font-bold">
                      {p.name}
                      {p.isDefault && <Badge tone="primary">Default</Badge>}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono">
                    {p.minLength}–{p.maxLength || "any"}
                  </TableCell>
                  <TableCell>
                    <span className="flex flex-wrap gap-1">
                      {classChips(p).map((c) => (
                        <span
                          className="rounded-xs border-[1.5px] border-ink px-1.5 py-0.5 font-mono text-[0.75rem] font-bold"
                          key={c}
                        >
                          {c}
                        </span>
                      ))}
                      {classChips(p).length === 0 && <span className="text-muted">Any</span>}
                    </span>
                  </TableCell>
                  <TableCell>{p.rotationDays ? `Every ${p.rotationDays} days` : "Never"}</TableCell>
                  <TableCell className="font-mono">{p.byTypeFields}</TableCell>
                  <TableCell>
                    <span className="flex justify-end gap-2">
                      <Button asChild size="sm" variant="secondary">
                        <Link aria-label={`Edit ${p.name}`} to={`/policies/${p.id}`}>
                          Edit
                        </Link>
                      </Button>
                      {p.deletable ? (
                        <fetcher.Form method="post">
                          <input name="intent" type="hidden" value="delete-policy" />
                          <input name="id" type="hidden" value={p.id} />
                          <input name="name" type="hidden" value={p.name} />
                          <Button
                            aria-label={`Delete ${p.name}`}
                            className="border-danger text-danger"
                            size="sm"
                            type="submit"
                            variant="secondary"
                          >
                            Delete
                          </Button>
                        </fetcher.Form>
                      ) : (
                        <Tooltip
                          content={
                            p.isDefault
                              ? "It's the default policy."
                              : `Used by ${p.byTypeFields} type fields.`
                          }
                        >
                          <Button
                            aria-disabled
                            aria-label={`Delete ${p.name}`}
                            className="cursor-not-allowed bg-sunken text-muted hover:bg-sunken"
                            size="sm"
                            variant="ghost"
                          >
                            Delete
                          </Button>
                        </Tooltip>
                      )}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
        <p className="m-0 text-small text-muted">
          Delete is off for the default policy and for policies in use.
        </p>
      </div>

      <Panel className="max-w-[35rem]" title="Default policy">
        <Field label="Default for new secrets">
          <Choice
            onChange={(policyId) =>
              void fetcher.submit({ intent: "default-policy", policyId }, { method: "post" })
            }
            options={policies.map((p) => ({
              label: `${p.name} (${p.minLength}–${p.maxLength || "any"})`,
              value: p.id,
            }))}
            value={security.defaultPasswordPolicyId ?? ""}
          />
        </Field>
      </Panel>
    </div>
  );
};

export default Policies;

export const ErrorBoundary = () => <PageError />;
