import { needsStepUp, refusalMessage, StepUpDialog, useStepUp } from "@sneakers-web/shell";
import { Button, cn, toast } from "@sneakers-web/ui";
import { Copy, Lock, Play, Square } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

import type { SecretType } from "@/features/secret/secret.server";

import { natoWords, partialMask } from "@/features/secret/phonetic";
import { PhoneticKeypad } from "@/features/secret/PhoneticKeypad";
import { useSecretFetcher } from "@/features/secret/useSecretFetcher";

type FieldDefinition = SecretType["fields"][number];

const MASK = "• • • • • • • • • • • •";
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
  const stepUp = useStepUp();
  const speech = useSpeech();
  const [hidden, setHidden] = useState<unknown>(null);
  const [phonetic, setPhonetic] = useState(false);
  const [full, setFull] = useState(false);
  const handled = useRef<unknown>(null);
  const label = target.versionNo ? `${field.label}, version ${target.versionNo}` : field.label;
  const result = fetcher.data;

  const send = useCallback(
    (purpose: "copy" | "show") =>
      void fetcher.submit(
        {
          fieldKey: target.fieldKey,
          intent: target.versionNo ? "reveal-version" : "reveal",
          purpose,
          ...(target.versionNo ? { versionNo: String(target.versionNo) } : {}),
        },
        { method: "post" },
      ),
    [fetcher, target.fieldKey, target.versionNo],
  );

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
    if (!result.ok) {
      if (needsStepUp(result.refusal))
        stepUp.ask(() => send(result.purpose === "copy" ? "copy" : "show"));
      return;
    }
    if (result.purpose === "copy" && result.value !== undefined) copy(result.value);
    else toast(`${field.label} revealed. This is logged.`);
  }, [copy, field.label, result, send, stepUp]);

  const value =
    result?.ok && result.purpose !== "copy" && result !== hidden ? result.value : undefined;
  const refusal = result && !result.ok && !needsStepUp(result.refusal) ? result.refusal : null;
  const busy = fetcher.state !== "idle";
  const masked = !!field.superSensitive && !full;

  const hide = () => {
    speech.stop();
    setPhonetic(false);
    setFull(false);
    setHidden(result);
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
