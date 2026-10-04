import { type Refusal, refusalMessage } from "@sneakers-web/shell";
import {
  Alert,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  PageHeader,
  plural,
  Segmented,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@sneakers-web/ui";
import { useState } from "react";
import { Form, Link, useNavigation } from "react-router";

import type { TargetEditorData } from "@/features/targets/targets.server";

import { KINDS, type TargetDraft } from "@/features/targets/model";

const listed = (names: string[]) =>
  names.length <= 1
    ? (names[0] ?? "")
    : `${names.slice(0, -1).join(", ")} or ${names.at(-1) ?? ""}`;

/** U-11: the target editor. Staff pick a connection; admins manage connections and pins. */
export const TargetForm = ({
  data,
  result,
}: {
  data: TargetEditorData;
  result?: { draft: TargetDraft; refusal: Refusal };
}) => {
  const { connections, sharedNames, target } = data;
  const busy = useNavigation().state === "submitting";
  const [d, setD] = useState<TargetDraft>(result?.draft ?? data.draft);
  const [tried, setTried] = useState(false);
  const set = (patch: Partial<TargetDraft>) => setD((current) => ({ ...current, ...patch }));
  const problems = {
    connectionId: d.connectionId ? undefined : "Pick a connection.",
    hostname: d.hostname.trim() ? undefined : "Give the hostname or address.",
    name: d.name.trim() ? undefined : "Give the target a name.",
  };
  const blocked = Object.values(problems).some(Boolean);
  const show = tried || !!result;
  // A kind the editor doesn't offer (set in the admin console) stays as it is.
  const kinds: { label: string; value: string }[] = KINDS.some((k) => k.value === d.kind)
    ? [...KINDS]
    : [...KINDS, { label: d.kind, value: d.kind }];

  return (
    <Form
      className="flex flex-col gap-6"
      method="post"
      onSubmit={(event) => {
        setTried(true);
        if (blocked) event.preventDefault();
      }}
    >
      <PageHeader
        actions={
          <>
            <Button asChild variant="secondary">
              <Link to="/targets">Cancel</Link>
            </Button>
            <Button loading={busy} loadingLabel="Saving…" type="submit">
              {target ? "Save target" : "Create target"}
            </Button>
          </>
        }
        eyebrow="Targets"
        subtitle={
          target
            ? `${target.scope === "personal" ? "Personal" : "Shared"} target · used by ${plural(target.secretCount, "secret")}`
            : "A system your secrets check or rotate against. It binds to a connection and adds its own hostname."
        }
        title={d.name.trim() || (target ? "Edit target" : "New target")}
      />
      {result?.refusal && (
        <Alert title="Couldn't save the target" tone="danger">
          {refusalMessage(result.refusal)}
        </Alert>
      )}
      <div className="grid items-start gap-6 desktop:grid-cols-2">
        <Card>
          <CardHeader className="border-b-0 pb-0" title="Details" />
          <div className="flex flex-col gap-4 p-5.5">
            <Field error={show ? problems.name : undefined} label="Name" required>
              <Input
                name="name"
                onChange={(event) => set({ name: event.target.value })}
                placeholder="e.g. home-nas"
                value={d.name}
              />
            </Field>
            <Field error={show ? problems.hostname : undefined} label="Hostname" required>
              <Input
                autoCapitalize="none"
                mono
                name="hostname"
                onChange={(event) => set({ hostname: event.target.value })}
                placeholder="e.g. nas.example.org"
                spellCheck={false}
                value={d.hostname}
              />
            </Field>
            <Field error={show ? problems.connectionId : undefined} label="Connection">
              <Select
                name="connectionId"
                onValueChange={(connectionId) => set({ connectionId })}
                value={d.connectionId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a connection" />
                </SelectTrigger>
                <SelectContent>
                  {connections.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field
              label={
                <>
                  Description <span className="font-normal text-muted">(optional)</span>
                </>
              }
            >
              <Input
                name="description"
                onChange={(event) => set({ description: event.target.value })}
                placeholder="Notes about this host"
                value={d.description}
              />
            </Field>
          </div>
        </Card>
        <Card>
          <CardHeader className="border-b-0 pb-0" title="Connector / heartbeat" />
          <div className="flex flex-col gap-4 p-5.5">
            <div className="flex flex-col gap-2">
              <span aria-hidden className="text-[0.875rem] font-bold">
                Kind
              </span>
              <Segmented
                className="flex-wrap"
                label="Kind"
                onChange={(kind) => set({ kind: kind === "none" ? "" : kind })}
                options={kinds.map((k) => ({
                  label: <span className="whitespace-nowrap">{k.label}</span>,
                  value: k.value || "none",
                }))}
                value={d.kind || "none"}
              />
              <input name="kind" type="hidden" value={d.kind} />
            </div>
            <Field label="Domain">
              <Input
                className="placeholder:font-sans"
                mono
                name="domain"
                onChange={(event) => set({ domain: event.target.value })}
                placeholder="Only for directory domains"
                value={d.domain}
              />
            </Field>
            <Field label="Realm">
              <Input
                className="placeholder:font-sans"
                mono
                name="realm"
                onChange={(event) => set({ realm: event.target.value })}
                placeholder="Only for directory domains"
                value={d.realm}
              />
            </Field>
          </div>
        </Card>
      </div>
      {sharedNames.length > 0 && (
        <Alert title="Shared targets are read-only here" tone="info">
          Ask an admin to change {listed(sharedNames)}.
        </Alert>
      )}
    </Form>
  );
};
