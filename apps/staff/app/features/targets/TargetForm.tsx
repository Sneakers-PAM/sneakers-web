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

import {
  capitalize,
  type ConnectionChoice,
  type ConnectionEntry,
  connectionsProblem,
  hostKindOf,
  KINDS,
  type TargetDraft,
} from "@/features/targets/model";

const listed = (names: string[]) =>
  names.length <= 1
    ? (names[0] ?? "")
    : `${names.slice(0, -1).join(", ")} or ${names.at(-1) ?? ""}`;

/** The editor's connections list: one row per connection, a default to pick among them, and an
 * add/remove control. A target binds to more than one connection only when its protocols
 * differ; the row-level picker leaves out a connection another row already uses. */
const ConnectionsField = ({
  choices,
  entries,
  onChange,
}: {
  choices: ConnectionChoice[];
  entries: ConnectionEntry[];
  onChange: (next: ConnectionEntry[]) => void;
}) => {
  const used = new Set(entries.map((entry) => entry.connectionId));
  const nextChoice = choices.find((c) => !used.has(c.value));
  return (
    <div className="flex flex-col gap-3">
      {entries.map((entry, index) => (
        <div className="flex items-end gap-3" key={index}>
          <Field className="flex-1" label={`Connection ${index + 1}`}>
            <Select
              name="connectionId"
              onValueChange={(connectionId) =>
                onChange(
                  entries.map((entry_, index_) =>
                    index_ === index ? { ...entry_, connectionId } : entry_,
                  ),
                )
              }
              value={entry.connectionId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a connection" />
              </SelectTrigger>
              <SelectContent>
                {choices
                  .filter((c) => c.value === entry.connectionId || !used.has(c.value))
                  .map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Field>
          <label className="flex items-center gap-1.5 pb-2.5 text-small whitespace-nowrap">
            <input
              checked={entry.isDefault}
              name="defaultConnectionId"
              onChange={() =>
                onChange(
                  entries.map((entry_, index_) => ({ ...entry_, isDefault: index_ === index })),
                )
              }
              type="radio"
              value={entry.connectionId}
            />
            Default
          </label>
          {entries.length > 1 && (
            <Button
              aria-label={`Remove connection ${index + 1}`}
              onClick={() => onChange(entries.filter((_, index_) => index_ !== index))}
              type="button"
              variant="secondary"
            >
              Remove
            </Button>
          )}
        </div>
      ))}
      {nextChoice && (
        <Button
          className="self-start"
          onClick={() =>
            onChange([...entries, { connectionId: nextChoice.value, isDefault: false }])
          }
          type="button"
          variant="secondary"
        >
          Add connection
        </Button>
      )}
    </div>
  );
};

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
    connections: connectionsProblem(d.connections, connections),
    hostname: d.hostname.trim()
      ? hostKindOf(d.hostname) === "invalid"
        ? "That doesn't look like a hostname, IPv4 or IPv6 address."
        : undefined
      : "Give the hostname or address.",
    name: d.name.trim() ? undefined : "Give the target a name.",
  };
  const blocked = Object.values(problems).some(Boolean);
  const show = tried || !!result;
  // A kind set elsewhere (the admin console) that this editor doesn't offer: kept pickable for
  // the life of the form, from the value the editor opened with, not the one currently picked
  // (which would drop it from the options the moment someone picks something else).
  const [unknownKind] = useState(() => {
    const initial = (result?.draft ?? data.draft).kind;
    return KINDS.some((k) => k.value === initial) ? "" : initial;
  });
  const kinds: { label: string; value: string }[] = unknownKind
    ? [...KINDS, { label: capitalize(unknownKind), value: unknownKind }]
    : [...KINDS];

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
            <Field
              error={show ? problems.hostname : undefined}
              hint="A hostname, an IPv4 address or an IPv6 address."
              label="Host"
              required
            >
              <Input
                autoCapitalize="none"
                mono
                name="hostname"
                onChange={(event) => set({ hostname: event.target.value })}
                placeholder="e.g. nas.example.org, 192.0.2.10 or 2001:db8::10"
                spellCheck={false}
                value={d.hostname}
              />
            </Field>
            <div className="flex flex-col gap-2">
              <span className="text-[0.875rem] font-bold">Connections</span>
              <ConnectionsField
                choices={connections}
                entries={d.connections}
                onChange={(next) => set({ connections: next })}
              />
              {show && problems.connections && (
                <span className="text-small text-danger">{problems.connections}</span>
              )}
            </div>
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
