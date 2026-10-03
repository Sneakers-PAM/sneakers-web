import {
  Alert,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  Button,
  Card,
  cn,
  Field,
  Input,
  Segmented,
  Switch,
} from "@sneakers-web/ui";
import { Check, Eye, Plus, X } from "lucide-react";
import { type ReactNode, useCallback, useId, useMemo, useState } from "react";

import type {
  AgentsResult,
  FolderChoice,
  SecretChoice,
  TokenChoice,
} from "@/features/agents/model";

import { FactorDialog, type SummaryLine } from "@/features/agents/FactorDialog";
import { DEFAULT_GRANT_FIELD, GRANT_MAX_HOURS } from "@/features/agents/model";

const DEFAULT_HOURS = 4;
const MAX_RESULTS = 6;

interface Program {
  argPattern: string;
  key: number;
  program: string;
}
type Scope = "folder" | "secrets";

const Choice = ({
  children,
  onClick,
  pressed,
}: {
  children: ReactNode;
  onClick: () => void;
  pressed: boolean;
}) => (
  <button
    aria-pressed={pressed}
    className={cn(
      "flex flex-col items-start gap-0.5 rounded-md border-[1.5px] border-border-strong bg-surface px-3.5 py-2 text-left text-[0.875rem] hover:border-control",
      pressed && "border-2 border-primary bg-primary-soft font-bold",
    )}
    onClick={onClick}
    type="button"
  >
    {children}
  </button>
);

const Group = ({
  children,
  hint,
  label,
}: {
  children: ReactNode;
  hint?: ReactNode;
  label: ReactNode;
}) => (
  <div className="flex flex-col gap-2">
    <span className="text-[0.875rem] font-bold">{label}</span>
    {children}
    {hint && <span className="text-small text-muted">{hint}</span>}
  </div>
);

const Problem = ({ children }: { children: ReactNode }) => (
  <span className="flex items-start gap-1 text-small font-bold text-danger" role="alert">
    <X aria-hidden className="mt-px size-3.5 shrink-0" strokeWidth={3} />
    {children}
  </span>
);

/** Search-to-add for the secrets a grant covers. */
const SecretPicker = ({
  invalid,
  onChange,
  picked,
  secrets,
}: {
  invalid: boolean;
  onChange: (ids: string[]) => void;
  picked: string[];
  secrets: SecretChoice[];
}) => {
  const [query, setQuery] = useState("");
  const listId = useId();
  const byId = useMemo(() => new Map(secrets.map((s) => [s.id, s])), [secrets]);
  const q = query.trim().toLowerCase();
  const results = q
    ? secrets
        .filter((s) => !picked.includes(s.id) && `${s.name} ${s.path}`.toLowerCase().includes(q))
        .slice(0, MAX_RESULTS)
    : [];
  return (
    <div className="relative flex flex-col gap-2">
      <div
        className={cn(
          "flex min-h-11 flex-wrap items-center gap-1.5 rounded-md border-[1.5px] border-control bg-surface px-2 py-1.5",
          invalid && "border-2 border-danger",
        )}
      >
        {picked.map((id) => {
          const name = byId.get(id)?.name ?? id;
          return (
            <span
              className="inline-flex items-center gap-1 rounded-sm bg-primary-soft px-2 py-1 text-[0.8125rem] font-bold text-primary"
              key={id}
            >
              {name}
              <button
                aria-label={`Remove ${name}`}
                className="hover:text-ink"
                onClick={() => onChange(picked.filter((x) => x !== id))}
                type="button"
              >
                <X aria-hidden className="size-3.5" />
              </button>
            </span>
          );
        })}
        <input
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={results.length > 0}
          aria-label="Secrets"
          className="min-w-40 flex-1 bg-transparent px-1 py-1 text-body text-ink outline-none placeholder:text-muted"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search secrets…"
          role="combobox"
          value={query}
        />
      </div>
      {results.length > 0 && (
        <ul
          className="absolute top-full z-10 m-0 mt-1 flex w-full list-none flex-col rounded-md border border-border bg-surface p-1 shadow-menu"
          id={listId}
          role="listbox"
        >
          {results.map((s) => (
            <li
              aria-selected={false}
              className="flex cursor-pointer items-baseline justify-between gap-3 rounded-sm px-3 py-2 text-[0.875rem] hover:bg-primary-soft"
              key={s.id}
              onClick={() => {
                onChange([...picked, s.id]);
                setQuery("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  onChange([...picked, s.id]);
                  setQuery("");
                }
              }}
              role="option"
              tabIndex={0}
            >
              <b>{s.name}</b>
              <span className="text-small text-muted">{s.path}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/**
 * The new-grant form (U-15): token, secrets or one folder, fields, programs, the window and
 * reveal. Creating goes through a confirm with the summary, then the second factor.
 */
export const GrantForm = ({
  folders,
  onClose,
  onCreated,
  secrets,
  tokens,
}: {
  folders: FolderChoice[];
  onClose: () => void;
  onCreated: (done: string) => void;
  secrets: SecretChoice[];
  tokens: TokenChoice[];
}) => {
  const [tokenId, setTokenId] = useState(tokens[0]?.id ?? "");
  const [scope, setScope] = useState<Scope>("secrets");
  const [secretIds, setSecretIds] = useState<string[]>([]);
  const [folderId, setFolderId] = useState(folders[0]?.id ?? "");
  const [fieldKeys, setFieldKeys] = useState<string[]>([]);
  const [programs, setPrograms] = useState<Program[]>([{ argPattern: "", key: 0, program: "" }]);
  const [hours, setHours] = useState(DEFAULT_HOURS);
  const [maxUses, setMaxUses] = useState("");
  const [allowReveal, setAllowReveal] = useState(false);
  const [tried, setTried] = useState(false);
  const [step, setStep] = useState<"confirm" | "factor" | null>(null);

  const secretById = useMemo(() => new Map(secrets.map((s) => [s.id, s])), [secrets]);
  const fieldChoices = useMemo(() => {
    const from =
      scope === "folder" ? secrets : secretIds.map((id) => secretById.get(id)).filter(Boolean);
    const keys = new Set<string>([DEFAULT_GRANT_FIELD]);
    for (const s of from) for (const k of s?.fields ?? []) keys.add(k);
    return [...keys];
  }, [scope, secrets, secretIds, secretById]);

  const named = programs.filter((p) => p.program.trim() !== "");
  const secretsMissing = scope === "secrets" && secretIds.length === 0;
  const folderMissing = scope === "folder" && !folderId;
  const programsMissing = named.length === 0 && !allowReveal;

  const token = tokens.find((t) => t.id === tokenId);
  const appliesTo =
    scope === "folder"
      ? `Folder: ${folders.find((f) => f.id === folderId)?.path ?? ""}`
      : secretIds.map((id) => secretById.get(id)?.name ?? id).join(", ");
  const programLine = named
    .map((p) => `${p.program.trim()} ${p.argPattern.trim() || "*"}`)
    .join("  ·  ");
  const summary: SummaryLine[] = [
    { label: "Token", value: token?.label ?? "" },
    { label: "Applies to", value: appliesTo },
    {
      label: "Fields",
      mono: true,
      value: (fieldKeys.length > 0 ? fieldKeys : [DEFAULT_GRANT_FIELD]).join(", "),
    },
    { label: "Programs", mono: true, value: programLine || "None" },
    {
      label: "Window",
      value: `${hours} h · ${maxUses ? `${maxUses} uses max` : "no use limit"}${allowReveal ? " · reveal allowed" : ""}`,
    },
  ];

  const fields = {
    allowReveal: String(allowReveal),
    fieldKeys: fieldKeys.join(","),
    folderId: scope === "folder" ? folderId : "",
    hours: String(hours),
    intent: "create",
    maxUses,
    programs: JSON.stringify(named.map(({ argPattern, program }) => ({ argPattern, program }))),
    scope,
    secretIds: scope === "secrets" ? secretIds.join(",") : "",
    tokenId,
  };

  const onDone = useCallback(
    (d: Extract<AgentsResult, { ok: true }>) => {
      setStep(null);
      onCreated(d.done);
    },
    [onCreated],
  );

  const setProgram = (key: number, patch: Partial<Program>) =>
    setPrograms((current) => current.map((p) => (p.key === key ? { ...p, ...patch } : p)));

  return (
    <Card className="flex flex-col gap-5 p-5.5">
      <form
        aria-label="New grant"
        className="flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          setTried(true);
          if (secretsMissing || folderMissing || programsMissing || !tokenId) return;
          setStep("confirm");
        }}
      >
        <div className="flex items-center gap-3">
          <h2 className="m-0 font-display text-[1.25rem] leading-[1.2] font-bold">New grant</h2>
          <Button className="ml-auto" onClick={onClose} size="sm" variant="ghost">
            Cancel
          </Button>
        </div>

        <Group label="Token">
          <div className="flex flex-wrap gap-2">
            {tokens.map((t) => (
              <Choice key={t.id} onClick={() => setTokenId(t.id)} pressed={t.id === tokenId}>
                <b>{t.label}</b>
                <span className="text-small font-normal text-muted">{t.app}</span>
              </Choice>
            ))}
          </div>
        </Group>

        <Group hint="Pick secrets or one folder, not both." label="Applies to">
          <Segmented
            className="max-w-sm"
            label="Applies to"
            onChange={setScope}
            options={[
              { label: "Specific secrets", value: "secrets" as const },
              { label: "One folder", value: "folder" as const },
            ]}
            value={scope}
          />
        </Group>

        {scope === "secrets" ? (
          <Group label="Secrets">
            <SecretPicker
              invalid={tried && secretsMissing}
              onChange={setSecretIds}
              picked={secretIds}
              secrets={secrets}
            />
            {tried && secretsMissing && <Problem>Pick at least one secret.</Problem>}
          </Group>
        ) : (
          <Group hint="Includes subfolders and secrets added later." label="Folder">
            <div className="flex flex-wrap gap-2">
              {folders.map((f) => (
                <Choice key={f.id} onClick={() => setFolderId(f.id)} pressed={f.id === folderId}>
                  {f.path}
                </Choice>
              ))}
            </div>
            {tried && folderMissing && <Problem>Pick a folder.</Problem>}
          </Group>
        )}

        <Group hint="None picked means the password field." label="Fields">
          <div className="flex flex-wrap gap-2">
            {fieldChoices.map((k) => {
              const on = fieldKeys.includes(k);
              return (
                <button
                  aria-pressed={on}
                  className={cn(
                    "inline-flex h-8 items-center gap-1 rounded-full border-[1.5px] border-control px-3 font-mono text-[0.8125rem]",
                    on && "border-primary bg-primary text-on-primary",
                  )}
                  key={k}
                  onClick={() =>
                    setFieldKeys(on ? fieldKeys.filter((x) => x !== k) : [...fieldKeys, k])
                  }
                  type="button"
                >
                  {on && <Check aria-hidden className="size-3.5" strokeWidth={3} />}
                  {k}
                </button>
              );
            })}
          </div>
        </Group>

        <Group
          label={
            <>
              Programs{" "}
              <span className="font-normal text-muted">
                · the value only goes to these, with matching arguments (* matches anything)
              </span>
            </>
          }
        >
          {programs.map((p, index) => (
            <div className="flex gap-2" key={p.key}>
              <Input
                aria-label={`Program ${index + 1}`}
                className="w-40 shrink-0 font-mono"
                onChange={(event) => setProgram(p.key, { program: event.target.value })}
                placeholder="program"
                value={p.program}
              />
              <Input
                aria-label={`Arguments ${index + 1}`}
                className="min-w-0 flex-1 font-mono"
                onChange={(event) => setProgram(p.key, { argPattern: event.target.value })}
                placeholder="arguments, e.g. -h db1.example.org *"
                value={p.argPattern}
              />
              <Button
                aria-label={`Remove program ${index + 1}`}
                onClick={() => setPrograms(programs.filter((x) => x.key !== p.key))}
                size="icon"
                variant="secondary"
              >
                <X aria-hidden />
              </Button>
            </div>
          ))}
          {tried && programsMissing && (
            <Problem>Add at least one program, or allow reveal.</Problem>
          )}
          <div>
            <Button
              onClick={() =>
                setPrograms([
                  ...programs,
                  {
                    argPattern: "",
                    key: Math.max(-1, ...programs.map((p) => p.key)) + 1,
                    program: "",
                  },
                ])
              }
              size="sm"
              variant="ghost"
            >
              <Plus aria-hidden />
              Add program
            </Button>
          </div>
        </Group>

        <div className="grid gap-5 tablet:grid-cols-[minmax(0,1fr)_12rem]">
          <Group
            label={
              <>
                Window · <span className="font-mono">{hours} h</span>{" "}
                <span className="font-normal text-muted">(max {GRANT_MAX_HOURS})</span>
              </>
            }
          >
            <input
              aria-label="Window in hours"
              className="accent-primary"
              max={GRANT_MAX_HOURS}
              min={1}
              onChange={(event) => setHours(Number(event.target.value))}
              type="range"
              value={hours}
            />
          </Group>
          <Field label="Max uses">
            <Input
              inputMode="numeric"
              onChange={(event) => setMaxUses(event.target.value.replaceAll(/\D/g, ""))}
              placeholder="No limit"
              value={maxUses}
            />
          </Field>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border-[1.5px] border-border p-4">
          <div className="flex items-center gap-4">
            <div className="flex flex-col gap-1">
              <b className="text-[0.9375rem]" id="grant-reveal-label">
                Allow reveal to the agent
              </b>
              <span className="text-small text-muted">
                Off: values only go into the programs above.
              </span>
            </div>
            <Switch
              aria-labelledby="grant-reveal-label"
              checked={allowReveal}
              className="ml-auto"
              onCheckedChange={setAllowReveal}
            />
          </div>
          {allowReveal && (
            <Alert tone="danger">
              <b>
                <Eye aria-hidden className="mr-1 inline size-4 align-[-3px]" />
                The agent will see these values.
              </b>{" "}
              They may end up in its logs or history. Turn this on only if the agent can&apos;t run
              the program itself.
            </Alert>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2.5 tablet:flex-row tablet:justify-end">
          <Button onClick={onClose} variant="secondary">
            Cancel
          </Button>
          <Button type="submit">Create grant…</Button>
        </div>
      </form>

      <AlertDialog onOpenChange={(open) => !open && setStep(null)} open={step === "confirm"}>
        <AlertDialogContent>
          <AlertDialogTitle>Create this grant?</AlertDialogTitle>
          <AlertDialogDescription>
            For this window, the token uses these secrets without asking you. Each use is still
            logged.
          </AlertDialogDescription>
          <dl className="m-0 flex flex-col rounded-xl bg-sunken px-4 py-1.5">
            {summary.map((line, index) => (
              <div
                className={cn(
                  "flex gap-3 py-2 text-[0.875rem] leading-[1.35]",
                  index > 0 && "border-t border-border",
                )}
                key={line.label}
              >
                <dt className="w-24 shrink-0 text-muted">{line.label}</dt>
                <dd className={cn("m-0 min-w-0 break-words", line.mono && "font-mono")}>
                  {line.value}
                </dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-col-reverse gap-2.5 tablet:flex-row tablet:justify-end">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                setStep("factor");
              }}
            >
              Continue
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <FactorDialog
        action="/grants"
        confirmLabel="Create grant"
        fields={fields}
        nothingDone="No grant was created."
        onDone={onDone}
        onOpenChange={(open) => !open && setStep(null)}
        open={step === "factor"}
        reveal={
          allowReveal ? (
            <>
              <b>This grant lets the agent see the values.</b> Each reveal is still logged.
            </>
          ) : undefined
        }
        summary={summary.slice(0, 3)}
        title="Confirm it's you"
      />
    </Card>
  );
};
