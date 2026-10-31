import { type Refusal } from "@sneakers-web/shell";
import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Pill,
  plural,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  toast,
} from "@sneakers-web/ui";
import { ArrowRight, Ban, Check, NotebookPen, SkipForward } from "lucide-react";
import { type ComponentProps, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useFetcher } from "react-router";

import type {
  ChangeTypeChoices,
  ChangeTypePreview,
  ChangeTypeResult,
} from "@/features/editors/changeType.server";
import type { SecretType } from "@/features/editors/validate";

import {
  automationLines,
  CHANGE_TYPE_ROUTE,
  type ChangeSubject,
  type FieldLabel,
  fieldLabeller,
  notesFieldOf,
  previewRefusal,
  typeChangeRefusal,
} from "@/features/editors/changeType";
import { FieldControl } from "@/features/editors/FieldControl";
import { PickOne } from "@/features/editors/PickOne";
import { TypePicker } from "@/features/editors/TypePicker";

/** Let typing settle before asking the vault again. */
const PREVIEW_DELAY_MS = 300;
const AUTOMATIC = "automatic";

type Change = ChangeTypePreview["fieldChanges"][number];
type Choices = Extract<ChangeTypeChoices, { ok: true }>;

interface Outcome {
  detail?: string;
  id: string;
  name: string;
  status: "changed" | "skipped";
}

const OUTCOME_PILL: Record<
  string,
  { icon: ReactNode; label: string; tone: ComponentProps<typeof Pill>["tone"] }
> = {
  blocked: { icon: <Ban aria-hidden />, label: "Blocked", tone: "danger" },
  carried: { icon: <Check aria-hidden />, label: "Carried over", tone: "ok" },
  movedToNotes: { icon: <NotebookPen aria-hidden />, label: "Moved to notes", tone: "warn" },
  renamed: { icon: <ArrowRight aria-hidden />, label: "Moved", tone: "primary" },
};

/** Where one stored value goes, and for any that isn't simply carried, a choice of field. */
const FieldRow = ({
  change,
  free,
  label,
  mapped,
  notes,
  onMap,
  to,
}: {
  change: Change;
  free: SecretType["fields"];
  label: FieldLabel;
  mapped: string;
  notes: string | undefined;
  onMap: (value: string) => void;
  to: SecretType;
}) => {
  const pill = OUTCOME_PILL[change.outcome] ?? OUTCOME_PILL.blocked;
  const sameKey = to.fields.some((f) => f.key === change.fromKey);
  const automatic = sameKey ? label(change.fromKey) : notes ? label(notes) : "No field";
  return (
    <TableRow>
      <TableCell>{label(change.fromKey)}</TableCell>
      <TableCell>
        {change.outcome === "carried" || (free.length === 0 && !mapped) ? (
          change.toKey ? (
            label(change.toKey)
          ) : (
            "No field"
          )
        ) : (
          <PickOne
            aria-label={`Where ${label(change.fromKey)} goes`}
            onChange={onMap}
            options={[
              { label: automatic, value: AUTOMATIC },
              ...free.map((f) => ({ label: f.label, value: f.key })),
            ]}
            value={mapped || AUTOMATIC}
          />
        )}
      </TableCell>
      <TableCell>
        <Pill icon={pill?.icon} tone={pill?.tone}>
          {pill?.label}
        </Pill>
      </TableCell>
    </TableRow>
  );
};

/** One secret: the vault's preview for the type picked, redone as the person answers it. */
const Review = ({
  choices,
  from,
  leaveLabel,
  onChanged,
  onLeave,
  onSkip,
  subject,
  to,
}: {
  choices: Choices;
  from: SecretType | undefined;
  leaveLabel: string;
  onChanged: () => void;
  onLeave: () => void;
  /** Absent for a single secret, where leaving is the way to refuse. */
  onSkip?: (detail?: string) => void;
  subject: ChangeSubject;
  to: SecretType;
}) => {
  const previewer = useFetcher<ChangeTypeResult>();
  const changer = useFetcher<ChangeTypeResult>();
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [extra, setExtra] = useState<Record<string, string>>({});
  const [sent, setSent] = useState("");
  const sentOnce = useRef(false);
  const label = fieldLabeller(to, from);
  const preview =
    previewer.data?.ok && previewer.data.intent === "preview" ? previewer.data.preview : null;

  const body = useMemo(() => {
    const targets = new Set(Object.values(mapping));
    return {
      fieldMapping: JSON.stringify(Object.entries(mapping).map(([f, t]) => ({ from: f, to: t }))),
      fields: JSON.stringify(
        Object.entries(extra)
          .filter(([key, value]) => value && !targets.has(key))
          .map(([key, value]) => ({ key, value })),
      ),
      id: subject.id,
      newTypeId: to.id,
    };
  }, [extra, mapping, subject.id, to.id]);
  const signature = JSON.stringify(body);

  const { submit } = previewer;
  useEffect(() => {
    const timer = setTimeout(
      () => {
        setSent(signature);
        void submit({ ...body, intent: "preview" }, { action: CHANGE_TYPE_ROUTE, method: "post" });
      },
      sentOnce.current ? PREVIEW_DELAY_MS : 0,
    );
    sentOnce.current = true;
    return () => clearTimeout(timer);
  }, [body, signature, submit]);

  const changed = changer.data;
  const seen = useRef<ChangeTypeResult | undefined>(undefined);
  useEffect(() => {
    if (changer.state !== "idle" || !changed || changed === seen.current) return;
    seen.current = changed;
    if (changed.ok) onChanged();
  }, [changed, changer.state, onChanged]);

  // Anything typed stays on screen: filling a field in takes it off the vault's missing list.
  const asking = [...new Set([...(preview?.missingRequiredKeys ?? []), ...Object.keys(extra)])]
    .filter((k) => !Object.values(mapping).includes(k))
    .flatMap((k) => to.fields.find((f) => f.key === k) ?? []);
  const notes = notesFieldOf(to);
  const taken = new Set(
    (preview?.fieldChanges ?? []).filter((c) => c.outcome === "carried").map((c) => c.toKey),
  );
  const freeFor = (fromKey: string) =>
    to.fields.filter(
      (f) =>
        f.key !== notes &&
        !taken.has(f.key) &&
        !extra[f.key]?.trim() &&
        !Object.entries(mapping).some(([k, t]) => t === f.key && k !== fromKey),
    );

  const previewFailed = previewer.data && !previewer.data.ok ? previewer.data.refusal : null;
  const changeFailed = changed && !changed.ok ? changed.refusal : null;
  const refused = preview && previewRefusal(preview);
  const askingForIt = refused?.reason === "FIELD_VALUE_REQUIRED" && asking.length > 0;
  const shown: null | Refusal = previewFailed ?? changeFailed ?? (askingForIt ? null : refused);
  const problem = shown && typeChangeRefusal(shown, label);
  const fresh = sent === signature && previewer.state === "idle";
  const moves = preview?.fieldChanges.some((c) => c.outcome === "movedToNotes");

  const confirm = () => {
    // Nothing was shown moving to notes, so nothing may: a value stored since then is refused.
    const unmappedFields = moves ? "notes" : "refuse";
    void changer.submit(
      { ...body, intent: "change", unmappedFields },
      { action: CHANGE_TYPE_ROUTE, method: "post" },
    );
  };

  return (
    <>
      {preview && (
        <>
          {preview.fieldChanges.length > 0 ? (
            <Table aria-label="Where each field goes">
              <TableHead>
                <tr>
                  <TableHeaderCell>Field</TableHeaderCell>
                  <TableHeaderCell>Goes to</TableHeaderCell>
                  <TableHeaderCell>Result</TableHeaderCell>
                </tr>
              </TableHead>
              <TableBody>
                {preview.fieldChanges.map((c) => (
                  <FieldRow
                    change={c}
                    free={freeFor(c.fromKey)}
                    key={c.fromKey}
                    label={label}
                    mapped={mapping[c.fromKey] ?? ""}
                    notes={notes}
                    onMap={(value) =>
                      setMapping((m) => {
                        const next = { ...m };
                        if (value === AUTOMATIC) delete next[c.fromKey];
                        else next[c.fromKey] = value;
                        return next;
                      })
                    }
                    to={to}
                  />
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="m-0 text-body text-muted">This secret has no stored values to move.</p>
          )}
          {asking.length > 0 && (
            <div className="flex flex-col gap-4">
              <p className="m-0 text-body font-bold">The new type needs</p>
              {asking.map((f) => (
                <FieldControl
                  editing={false}
                  field={f}
                  key={f.key}
                  onChange={(value) => setExtra((previous) => ({ ...previous, [f.key]: value }))}
                  policies={choices.policies}
                  value={extra[f.key] ?? ""}
                />
              ))}
            </div>
          )}
          <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-body">
            {automationLines(
              preview,
              (id) => choices.targets.find((t) => t.id === id)?.name ?? "The target",
            ).map((line) => (
              <div className="contents" key={line.label}>
                <dt className="font-bold">{line.label}</dt>
                <dd className="m-0 text-muted">{line.text}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
      {!preview && !previewFailed && <p className="m-0 text-body text-muted">Checking…</p>}
      {problem && (
        <Alert role="alert" tone="danger">
          {problem}
        </Alert>
      )}
      <DialogFooter>
        <Button onClick={onLeave} variant="secondary">
          {leaveLabel}
        </Button>
        {onSkip && (
          <Button
            disabled={changer.state !== "idle"}
            onClick={() => onSkip(problem ?? undefined)}
            variant="secondary"
          >
            Skip
          </Button>
        )}
        <Button
          disabled={!fresh || !preview?.allowed}
          loading={changer.state !== "idle"}
          onClick={confirm}
        >
          Change type
        </Button>
      </DialogFooter>
    </>
  );
};

const Results = ({ onClose, outcomes }: { onClose: () => void; outcomes: Outcome[] }) => (
  <>
    <Table aria-label="Results">
      <TableHead>
        <tr>
          <TableHeaderCell>Secret</TableHeaderCell>
          <TableHeaderCell>Result</TableHeaderCell>
        </tr>
      </TableHead>
      <TableBody>
        {outcomes.map((o) => (
          <TableRow key={o.id}>
            <TableCell>
              {o.name}
              {o.detail && <span className="block text-small text-muted">{o.detail}</span>}
            </TableCell>
            <TableCell>
              {o.status === "changed" ? (
                <Pill icon={<Check aria-hidden />} tone="ok">
                  Changed
                </Pill>
              ) : (
                <Pill icon={<SkipForward aria-hidden />} tone="neutral">
                  Skipped
                </Pill>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
    <DialogFooter>
      <Button onClick={onClose}>Close</Button>
    </DialogFooter>
  </>
);

/**
 * Change one secret's type, or a selection's one at a time: pick the type, then the vault's
 * preview of each secret (keys only) with a confirm, then a report on a selection. `onChanged`
 * runs after each change, once the page's own data has been reloaded.
 */
export const ChangeTypeDialog = ({
  note,
  onChanged,
  onClose,
  secrets,
}: {
  /** A line under the title, for what's particular to where the flow was opened. */
  note?: string;
  onChanged?: () => void;
  onClose: () => void;
  secrets: ChangeSubject[];
}) => {
  const loader = useFetcher<ChangeTypeChoices>();
  const [typeId, setTypeId] = useState("");
  const [queue, setQueue] = useState<ChangeSubject[] | null>(null);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const single = secrets.length === 1;
  const only = single ? secrets[0] : undefined;

  const { load } = loader;
  useEffect(() => {
    void load(CHANGE_TYPE_ROUTE);
  }, [load]);

  const choices = loader.data?.ok ? loader.data : null;
  const to = choices?.types.find((t) => t.id === typeId);
  const current = queue?.[0];
  const done = queue !== null && !current;
  const skip = (subject: ChangeSubject, detail?: string) => {
    setOutcomes((o) => [...o, { detail, id: subject.id, name: subject.name, status: "skipped" }]);
    setQueue((q) => q?.slice(1) ?? null);
  };

  const begin = () => {
    const already = secrets.filter((s) => s.typeId === typeId);
    setOutcomes(
      already.map((s) => ({
        detail: `Already ${to?.name}.`,
        id: s.id,
        name: s.name,
        status: "skipped" as const,
      })),
    );
    setQueue(secrets.filter((s) => s.typeId !== typeId));
  };

  const title = () => {
    if (done) return "Change type: results";
    if (!current)
      return only
        ? `Change the type of ${only.name}`
        : `Change type of ${plural(secrets.length, "secret")}`;
    return `${current.name} to ${to?.name}`;
  };

  return (
    <Dialog onOpenChange={(o) => !o && onClose()} open>
      <DialogContent className="max-h-[90dvh] max-w-[40rem] overflow-y-auto" hideClose>
        <DialogHeader>
          <DialogTitle>{title()}</DialogTitle>
          <DialogDescription>
            {current && !single
              ? `Secret ${secrets.length - queue.length + 1} of ${secrets.length}. This preview is for this secret only.`
              : "Sneakers shows what happens to each field first. Nothing changes until you confirm."}
            {note && !done && ` ${note}`}
          </DialogDescription>
        </DialogHeader>
        {queue === null && (
          <>
            {loader.data && !loader.data.ok && (
              <Alert role="alert" tone="danger">
                {typeChangeRefusal(loader.data.refusal, (k) => k)}
              </Alert>
            )}
            {choices ? (
              <Field label="New type" required>
                <TypePicker
                  onChange={setTypeId}
                  types={choices.types.filter((t) => t.id !== only?.typeId)}
                  value={typeId}
                />
              </Field>
            ) : (
              !loader.data && <p className="m-0 text-body text-muted">Loading the types…</p>
            )}
            <DialogFooter>
              <Button onClick={onClose} variant="secondary">
                Cancel
              </Button>
              <Button disabled={!to} onClick={begin}>
                Continue
              </Button>
            </DialogFooter>
          </>
        )}
        {current && choices && to && (
          <Review
            choices={choices}
            from={choices.types.find((t) => t.id === current.typeId)}
            key={current.id}
            leaveLabel={single ? "Cancel" : "Stop here"}
            onChanged={() => {
              onChanged?.();
              if (single) {
                toast(`${current.name} is now ${to.name}`);
                onClose();
                return;
              }
              setOutcomes((o) => [...o, { id: current.id, name: current.name, status: "changed" }]);
              setQueue((q) => q?.slice(1) ?? null);
            }}
            onLeave={() => {
              if (single) {
                onClose();
                return;
              }
              setOutcomes((o) => [
                ...o,
                ...(queue ?? []).map((s) => ({
                  id: s.id,
                  name: s.name,
                  status: "skipped" as const,
                })),
              ]);
              setQueue([]);
            }}
            onSkip={single ? undefined : (detail) => skip(current, detail)}
            subject={current}
            to={to}
          />
        )}
        {done && <Results onClose={onClose} outcomes={outcomes} />}
      </DialogContent>
    </Dialog>
  );
};
