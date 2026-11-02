import { Alert, Button, Field, PageHeader, toast } from "@sneakers-web/ui";
import { ArrowRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFetcher, useLocation, useNavigate, useSearchParams } from "react-router";

import type {
  ChangeTypeResult,
  ChangeTypePage as PageData,
} from "@/features/editors/changeType.server";

import {
  automationLines,
  type ChangeOutcome,
  changeTypePath,
  type ChangeTypeTrip,
  fieldLabeller,
  previewRefusal,
  typeChangeRefusal,
} from "@/features/editors/changeType";
import { ChangeTypeResults } from "@/features/editors/ChangeTypeResults";
import {
  assess,
  type Item,
  propose,
  type StoredField,
  storedFields,
} from "@/features/editors/lineUp";
import { LineUpStep } from "@/features/editors/LineUpStep";
import { ReviewStep } from "@/features/editors/ReviewStep";
import { TypePicker } from "@/features/editors/TypePicker";
import { RevealRunProvider } from "@/features/secret/revealRun";

/** Let typing settle before asking the vault again. */
const PREVIEW_DELAY_MS = 300;

interface Layout {
  left: StoredField[];
  order: Item[];
  toId: string;
}

/**
 * Change a secret's type in two steps: line up the stored fields against the new type's, then
 * review what moves. The vault's preview (keys only) runs on every change; nothing is written
 * until Change type. A selection from the list comes through one secret at a time.
 */
export const ChangeTypePage = ({ page }: { page: PageData }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [parameters] = useSearchParams();
  const trip = (location.state ?? {}) as ChangeTypeTrip;
  const back = trip.from ?? `/secret/${page.secret.id}`;
  const selection = trip.selection && trip.selection.length > 1 ? trip.selection : undefined;
  const earlier = useMemo(() => trip.outcomes ?? [], [trip.outcomes]);
  const position = selection ? selection.findIndex((s) => s.id === page.secret.id) : -1;

  const from = page.types.find((t) => t.id === page.secret.typeId);
  const [toId, setToId] = useState(() => parameters.get("to") ?? "");
  const to = page.types.find((t) => t.id === toId && t.id !== page.secret.typeId);
  const [layout, setLayout] = useState<Layout | null>(null);
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [step, setStep] = useState<1 | 2>(1);
  const [focusKey, setFocusKey] = useState<string | undefined>();

  const previewer = useFetcher<ChangeTypeResult>();
  const changer = useFetcher<ChangeTypeResult>();
  const lined = layout && to && layout.toId === to.id ? layout : null;
  const assessment = useMemo(
    () => (lined && to ? assess(lined.left, lined.order, to, typed) : null),
    [lined, to, typed],
  );

  const body = useMemo(() => {
    const filling = new Set(assessment?.unfilled.map((f) => f.key));
    return {
      fieldMapping: JSON.stringify(assessment?.mapping ?? []),
      fields: JSON.stringify(
        Object.entries(typed)
          .filter(([key, value]) => filling.has(key) && value.trim())
          .map(([key, value]) => ({ key, value })),
      ),
      newTypeId: to?.id ?? "",
    };
  }, [assessment, to, typed]);
  const signature = JSON.stringify(body);
  const [sent, setSent] = useState("");
  const sentOnce = useRef(false);

  const { submit } = previewer;
  useEffect(() => {
    if (!body.newTypeId) return;
    const timer = setTimeout(
      () => {
        setSent(signature);
        void submit({ ...body, intent: "preview" }, { method: "post" });
      },
      sentOnce.current ? PREVIEW_DELAY_MS : 0,
    );
    sentOnce.current = true;
    return () => clearTimeout(timer);
  }, [body, signature, submit]);

  const answer = previewer.data;
  const preview =
    answer?.ok && answer.intent === "preview" && answer.newTypeId === to?.id
      ? answer.preview
      : null;

  // The first preview for a type says which values are stored; the line-up starts from those.
  if (preview && to && layout?.toId !== to.id) {
    const left = storedFields(
      preview.fieldChanges.map((c) => c.fromKey),
      from,
    );
    setLayout({ left, order: propose(left, to), toId: to.id });
  }

  const label = to ? fieldLabeller(to, from) : (k: string) => k;
  const previewFailed = answer && !answer.ok ? answer.refusal : null;
  const changed = changer.data;
  const changeFailed = changed && !changed.ok ? changed.refusal : null;
  const fresh = sent === signature && previewer.state === "idle" && !!preview;
  const localTrouble =
    !!assessment && (assessment.problems.length > 0 || assessment.missing.length > 0);
  const vaultRefusal =
    previewFailed ?? (fresh && !localTrouble && preview ? previewRefusal(preview) : null);
  const vaultProblem = vaultRefusal ? typeChangeRefusal(vaultRefusal, label) : null;
  const ready = !!assessment && !localTrouble && fresh && !!preview?.allowed;

  // The results are the end of the trip: they live in its state, so Back doesn't redo a change.
  const showResults = useCallback(
    (outcomes: ChangeOutcome[]) =>
      void navigate(`${location.pathname}${location.search}`, {
        replace: true,
        state: { from: back, results: outcomes } satisfies ChangeTypeTrip,
      }),
    [back, location.pathname, location.search, navigate],
  );

  const goOn = useCallback(
    (outcomes: ChangeOutcome[]) => {
      const to = page.types.find((t) => t.id === toId);
      if (!selection || !to) return;
      const done = [...outcomes];
      let next;
      for (const s of selection.slice(position + 1)) {
        if (s.typeId !== to.id) {
          next = s;
          break;
        }
        done.push({ detail: `Already ${to.name}.`, id: s.id, name: s.name, status: "skipped" });
      }
      if (!next) {
        showResults(done);
        return;
      }
      void navigate(changeTypePath(next.id, to.id), {
        state: { from: back, outcomes: done, selection } satisfies ChangeTypeTrip,
      });
    },
    [back, navigate, page.types, position, selection, showResults, toId],
  );

  // Once changed, the secret is on the new type, so this looks the type up by id, not as `to`.
  const chosen = page.types.find((t) => t.id === toId);
  const seen = useRef<ChangeTypeResult | undefined>(undefined);
  useEffect(() => {
    if (changer.state !== "idle" || !changed || changed === seen.current) return;
    seen.current = changed;
    if (!changed.ok || !chosen) return;
    if (selection) {
      goOn([...earlier, { id: page.secret.id, name: page.secret.name, status: "changed" }]);
      return;
    }
    toast(`${page.secret.name} is now ${chosen.name}`);
    void navigate(back);
  }, [back, changed, changer.state, chosen, earlier, goOn, navigate, page.secret, selection]);

  const pickType = (id: string) => {
    setToId(id);
    setLayout(null);
    setTyped({});
    setStep(1);
  };

  const confirm = () => {
    const moves = preview?.fieldChanges.some((c) => c.outcome === "movedToNotes");
    // Nothing was shown moving to notes, so nothing may: a value stored since then is refused.
    void changer.submit(
      { ...body, intent: "change", unmappedFields: moves ? "notes" : "refuse" },
      { method: "post" },
    );
  };

  const skip = () =>
    goOn([
      ...earlier,
      {
        detail: assessment?.problems[0] ?? vaultProblem ?? undefined,
        id: page.secret.id,
        name: page.secret.name,
        status: "skipped",
      },
    ]);

  const stop = () =>
    showResults([
      ...earlier,
      ...(selection ?? [])
        .slice(position)
        .map((s) => ({ id: s.id, name: s.name, status: "skipped" as const })),
    ]);

  const results = trip.results;
  if (results) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader eyebrow="Change type" title="Results" />
        <ChangeTypeResults onDone={() => void navigate(back)} outcomes={results} />
      </div>
    );
  }

  const subtitle =
    step === 1 ? "Step 1 of 2: line up the fields" : "Step 2 of 2: review what moves";

  return (
    <RevealRunProvider>
      <div className="flex flex-col gap-6">
        <PageHeader
          actions={
            <>
              <Button
                onClick={() => (selection ? stop() : void navigate(back))}
                variant="secondary"
              >
                {selection ? "Stop here" : "Cancel"}
              </Button>
              {selection && (
                <Button disabled={changer.state !== "idle"} onClick={skip} variant="secondary">
                  Skip
                </Button>
              )}
              {step === 1 ? (
                <Button disabled={!ready} onClick={() => setStep(2)}>
                  Next: review
                </Button>
              ) : (
                <>
                  <Button onClick={() => setStep(1)} variant="secondary">
                    Back to step 1
                  </Button>
                  <Button disabled={!ready} loading={changer.state !== "idle"} onClick={confirm}>
                    Change type
                  </Button>
                </>
              )}
            </>
          }
          eyebrow={page.secret.name}
          subtitle={
            selection
              ? `${subtitle}. Secret ${position + 1} of ${selection.length}; this is for this secret only.`
              : subtitle
          }
          title="Change type"
        />

        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-2">
            <span className="eyebrow">Current type</span>
            <b className="text-body">{from?.name ?? page.secret.typeId}</b>
          </div>
          <ArrowRight aria-hidden className="mb-3 size-5 text-muted" />
          <Field className="min-w-60 flex-1" label="New type" required>
            <TypePicker
              disabled={step === 2 || (!!selection && position > 0)}
              onChange={pickType}
              types={page.types.filter((t) => t.id !== page.secret.typeId)}
              value={toId}
            />
          </Field>
        </div>

        {!to && (
          <p className="m-0 text-body text-muted">Pick the new type to line up the fields.</p>
        )}
        {to && !lined && !previewFailed && <p className="m-0 text-body text-muted">Checking…</p>}
        {previewFailed && !lined && (
          <Alert role="alert" tone="danger">
            {vaultProblem}
          </Alert>
        )}

        {to && lined && assessment && step === 1 && (
          <LineUpStep
            assessment={assessment}
            focusKey={focusKey}
            left={lined.left}
            onOrder={(order) => setLayout({ ...lined, order })}
            onTyped={(key, value) => setTyped((t) => ({ ...t, [key]: value }))}
            order={lined.order}
            policies={page.policies}
            to={to}
            typed={typed}
            vaultProblem={vaultProblem}
          />
        )}

        {to && lined && assessment && step === 2 && (
          <>
            <ReviewStep
              assessment={assessment}
              onChange={(key) => {
                setFocusKey(key);
                setStep(1);
              }}
              to={to}
              typed={typed}
              values={page.values}
            />
            {preview && (
              <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-body">
                {automationLines(
                  preview,
                  (id) => page.targets.find((t) => t.id === id)?.name ?? "The target",
                ).map((line) => (
                  <div className="contents" key={line.label}>
                    <dt className="font-bold">{line.label}</dt>
                    <dd className="m-0 text-muted">{line.text}</dd>
                  </div>
                ))}
              </dl>
            )}
            {(changeFailed ?? (fresh && !preview?.allowed ? vaultRefusal : null)) && (
              <Alert role="alert" tone="danger">
                {typeChangeRefusal(
                  changeFailed ?? (vaultRefusal as NonNullable<typeof vaultRefusal>),
                  label,
                )}{" "}
                Go back to step 1 to fix it.
              </Alert>
            )}
          </>
        )}
      </div>
    </RevealRunProvider>
  );
};
