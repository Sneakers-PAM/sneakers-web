import { needsStepUp, refusalMessage, StepUpDialog, useStepUp } from "@sneakers-web/shell";
import { Button, cn, toast } from "@sneakers-web/ui";
import { Clock, Copy, Lock, Play, Square } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";

import type { SecretType } from "@/features/secret/secret.server";

import { natoWords, partialMask } from "@/features/secret/phonetic";
import { PhoneticKeypad } from "@/features/secret/PhoneticKeypad";
import { useRevealRunId } from "@/features/secret/revealRun";
import { useSecretFetcher } from "@/features/secret/useSecretFetcher";

type FieldDefinition = SecretType["fields"][number];

const MASK = "• • • • • • • • • • • •";
// How often a held reveal checks whether it was decided.
const COLLECT_MS = 5000;
const SPEAK_LEAD_IN_MS = 1000;

/** Where the value comes from: the live field, or one field of an earlier version. */
export interface RevealTarget {
  fieldKey: string;
  versionNo?: number;
}

const useSpeech = () => {
  const [speaking, setSpeaking] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const stop = useCallback(() => {
    globalThis.clearTimeout(timer.current);
    if ("speechSynthesis" in globalThis) globalThis.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);
  useEffect(() => stop, [stop]);
  const start = (value: string) => {
    if (!("speechSynthesis" in globalThis)) {
      toast.error("Speech isn't available in this browser.");
      return;
    }
    globalThis.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(natoWords(value));
    utterance.rate = 0.7;
    utterance.addEventListener("end", () => setSpeaking(false));
    utterance.addEventListener("error", () => setSpeaking(false));
    setSpeaking(true);
    // A short lead-in so the first letters aren't clipped while the voice loads.
    timer.current = globalThis.setTimeout(
      () => globalThis.speechSynthesis.speak(utterance),
      SPEAK_LEAD_IN_MS,
    );
  };
  return { speaking, start, stop };
};

/**
 * A sensitive value: masked until a reveal, which goes through the page's action (audited,
 * and step-up first where the vault asks). Revealed, it can be copied, spelled out on the
 * keypad, read aloud and hidden again. A super-sensitive value shows its ends first.
 */
export const SensitiveValue = ({
  compact,
  field,
  hint,
  locked,
  target,
}: {
  /** History rows: no phonetic tools, a smaller box. */
  compact?: boolean;
  field: Pick<FieldDefinition, "label" | "superSensitive">;
  hint?: ReactNode;
  /** Why it can't be revealed right now, shown in place of the controls. */
  locked?: string;
  target: RevealTarget;
}) => {
  const fetcher = useSecretFetcher({ quiet: true });
  const collector = useSecretFetcher({ quiet: true });
  const runId = useRevealRunId();
  const stepUp = useStepUp();
  const speech = useSpeech();
  const [hidden, setHidden] = useState<unknown>(null);
  const [phonetic, setPhonetic] = useState(false);
  const [full, setFull] = useState(false);
  const handled = useRef<unknown>(null);
  const label = target.versionNo ? `${field.label}, version ${target.versionNo}` : field.label;
  const result = fetcher.data;
  // A reveal the secret's approval level holds, until a collect for it releases or refuses it.
  const heldUse = result?.ok ? result.pendingUse : undefined;
  const lastCollect = collector.data;
  const forHeld = !!heldUse && lastCollect?.useId === heldUse.id;
  const collected = forHeld && lastCollect?.ok && !lastCollect.pendingUse ? lastCollect : undefined;
  const collectRefused = forHeld && lastCollect?.ok === false ? lastCollect : undefined;
  const heldPurpose = result?.purpose === "copy" ? "copy" : "show";
  const held = useMemo(
    () =>
      heldUse && !collected && !collectRefused ? { purpose: heldPurpose, use: heldUse } : null,
    [collectRefused, collected, heldPurpose, heldUse],
  );

  const send = useCallback(
    (purpose: "copy" | "show") =>
      void fetcher.submit(
        {
          fieldKey: target.fieldKey,
          intent: target.versionNo ? "reveal-version" : "reveal",
          purpose,
          runId,
          ...(target.versionNo ? { versionNo: String(target.versionNo) } : {}),
        },
        { method: "post" },
      ),
    [fetcher, runId, target.fieldKey, target.versionNo],
  );

  // A held reveal checks back until it's decided, expires or is collected.
  useEffect(() => {
    if (!held) return;
    const iv = setInterval(() => {
      if (collector.state !== "idle") return;
      void collector.submit(
        {
          confirm: String(held.use.confirm),
          expiresAt: String(held.use.expiresAt),
          fieldKey: target.fieldKey,
          intent: "reveal-collect",
          purpose: held.purpose,
          runId: held.use.runId ?? "",
          useId: held.use.id,
        },
        { method: "post" },
      );
    }, COLLECT_MS);
    return () => clearInterval(iv);
  }, [collector, held, target.fieldKey]);

  const copy = useCallback(
    (value: string) =>
      void navigator.clipboard
        .writeText(value)
        .then(() => toast(`${field.label} copied. This is logged.`))
        .catch(() => toast.error("Couldn't copy. Reveal the value and copy it by hand.")),
    [field.label],
  );

  useEffect(() => {
    if (!result || handled.current === result) return;
    handled.current = result;
    if (result.ok && result.pendingUse) return;
    if (!result.ok) {
      if (needsStepUp(result.refusal))
        stepUp.ask(() => send(result.purpose === "copy" ? "copy" : "show"));
      return;
    }
    if (result.purpose === "copy" && result.value !== undefined) copy(result.value);
    else toast(`${field.label} revealed. This is logged.`);
  }, [copy, field.label, result, send, stepUp]);

  useEffect(() => {
    if (collected?.purpose === "copy" && collected.value !== undefined) copy(collected.value);
    else if (collected) toast(`${field.label} revealed. This is logged.`);
  }, [collected, copy, field.label]);
  const latest = collected ?? result;
  const value =
    latest?.ok && latest.purpose !== "copy" && latest !== hidden ? latest.value : undefined;
  const refusal =
    collectRefused?.refusal ??
    (result && !result.ok && !needsStepUp(result.refusal) ? result.refusal : null);
  const busy = fetcher.state !== "idle";
  const masked = !!field.superSensitive && !full;

  const hide = () => {
    speech.stop();
    setPhonetic(false);
    setFull(false);
    setHidden(latest);
  };

  const box = cn(
    "flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-md px-4 font-mono",
    compact && "min-h-10 px-3",
  );

  return (
    <div className="flex flex-col gap-2.5">
      {locked ? (
        <div className="flex flex-wrap items-center gap-2">
          <div
            className={cn(
              box,
              "border-[1.5px] border-dashed border-border-strong bg-sunken text-muted",
            )}
          >
            <Lock aria-hidden className="size-4 shrink-0" />
            <span aria-hidden className="truncate">
              {MASK}
            </span>
            <b className="ml-auto font-sans text-small text-ink">{locked}</b>
          </div>
        </div>
      ) : held ? (
        <div className="flex flex-col gap-2" role="status">
          <div className={cn(box, "bg-sunken text-muted")}>
            <Clock aria-hidden className="size-4 shrink-0" />
            <span className="font-sans text-[0.875rem] text-ink">
              {held.use.confirm
                ? "Nobody else can approve this. Confirm it once with your second factor."
                : "Waiting for an owner or approver of this secret. Nobody approves their own request."}
            </span>
          </div>
          {held.use.runId && (
            <Link
              className="text-small font-bold text-primary hover:text-ink"
              rel="noreferrer"
              target="_blank"
              to={`/approvals/run/${encodeURIComponent(held.use.runId)}`}
            >
              {held.use.confirm ? "Confirm this task" : "See this task's requests"}
            </Link>
          )}
        </div>
      ) : value === undefined ? (
        <div className="flex flex-wrap items-center gap-2">
          <div
            aria-label={`${label}, hidden`}
            className={cn(box, "bg-sunken text-muted")}
            role="img"
          >
            <span aria-hidden className="truncate">
              {MASK}
            </span>
          </div>
          <Button
            aria-label={`Reveal ${label}`}
            loading={busy}
            loadingLabel="Revealing…"
            onClick={() => send("show")}
            size={compact ? "sm" : "md"}
            variant={field.superSensitive || compact ? "secondary" : "primary"}
          >
            Reveal
          </Button>
          {!field.superSensitive && !compact && (
            <Button aria-label={`Copy ${label}`} onClick={() => send("copy")} variant="secondary">
              <Copy aria-hidden />
              Copy
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className={cn(box, "border-2 border-primary bg-reveal text-ink")}>
              <span className="min-w-0 text-value break-all">
                {masked ? partialMask(value) : value}
              </span>
              <span className="ml-auto shrink-0 font-sans text-[0.75rem] font-bold text-primary">
                Revealed · logged
              </span>
            </div>
            {masked && (
              <Button
                onClick={() => setFull(true)}
                size={compact ? "sm" : "md"}
                variant="secondary"
              >
                Show all
              </Button>
            )}
            <Button onClick={hide} size={compact ? "sm" : "md"} variant="secondary">
              Hide
            </Button>
            <Button
              aria-label={`Copy ${label}`}
              onClick={() => copy(value)}
              size={compact ? "sm" : "md"}
              variant="secondary"
            >
              <Copy aria-hidden />
              Copy
            </Button>
          </div>
          {!compact && !masked && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                aria-pressed={phonetic}
                onClick={() => setPhonetic((p) => !p)}
                size="sm"
                variant={phonetic ? "primary" : "secondary"}
              >
                Phonetic
              </Button>
              <Button
                onClick={() => (speech.speaking ? speech.stop() : speech.start(value))}
                size="sm"
                variant="secondary"
              >
                {speech.speaking ? <Square aria-hidden /> : <Play aria-hidden />}
                {speech.speaking ? "Stop" : "Speak"}
              </Button>
              <span className="text-small text-muted">
                For reading the value aloud over the phone
              </span>
            </div>
          )}
          {phonetic && !masked && <PhoneticKeypad label={field.label} value={value} />}
        </>
      )}
      {hint && <span className="text-small text-muted">{hint}</span>}
      {refusal && (
        <span className="text-small font-bold text-danger" role="alert">
          {refusalMessage(refusal)}
        </span>
      )}
      <StepUpDialog
        {...stepUp.dialog}
        description={`Revealing ${label} needs a fresh second factor.`}
      />
    </div>
  );
};
