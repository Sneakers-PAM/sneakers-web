import { getAssertion, passkeysSupported } from "@sneakers-web/api-client";
import {
  Alert,
  Button,
  CodeInput,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Segmented,
  useIsClient,
} from "@sneakers-web/ui";
import { KeyRound, X } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";

import type { StepUpState } from "#shell/server/stepUp.server";

type Factor = "email" | "passkey" | "totp";

/** Where the prompt posts. Each app mounts `stepUpAction` at this resource route. */
export const STEP_UP_ROUTE = "/resources/step-up";

const PROBLEMS = {
  passkey: "The passkey step didn't finish. Try again, or use a code.",
  unavailable: "We couldn't check that just now. Try again in a moment.",
};

export interface StepUpDialogProps {
  /** What the person is confirming, such as the field and secret, shown above the factor. */
  children?: ReactNode;
  confirmLabel?: string;
  description?: ReactNode;
  onOpenChange: (open: boolean) => void;
  /** The session has a fresh second factor now: retry the call that asked for it. */
  onVerified: () => void;
  open: boolean;
  title?: ReactNode;
}

/**
 * The step-up prompt: shown when the gateway answers STEP_UP_REQUIRED. The person proves a
 * second factor again (authenticator, emailed code or passkey), then `onVerified` retries.
 */
export const StepUpDialog = ({
  children,
  confirmLabel = "Confirm",
  description = "This needs a fresh second factor. Enter a code to carry on.",
  onOpenChange,
  onVerified,
  open,
  title = "Confirm it's you",
}: StepUpDialogProps) => {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        {open && (
          <Prompt
            confirmLabel={confirmLabel}
            description={description}
            onCancel={() => onOpenChange(false)}
            onVerified={onVerified}
            title={title}
          >
            {children}
          </Prompt>
        )}
      </DialogContent>
    </Dialog>
  );
};

const Prompt = ({
  children,
  confirmLabel,
  description,
  onCancel,
  onVerified,
  title,
}: {
  children?: ReactNode;
  confirmLabel: string;
  description: ReactNode;
  onCancel: () => void;
  onVerified: () => void;
  title: ReactNode;
}) => {
  const fetcher = useFetcher<StepUpState>();
  const client = useIsClient();
  const input = useRef<HTMLInputElement>(null);
  const [factor, setFactor] = useState<Factor>("totp");
  // A wrong code stays marked until it's edited: `for` is the answer the last edit followed.
  const [typed, setTyped] = useState<{ code: string; for: StepUpState | undefined }>({
    code: "",
    for: undefined,
  });
  const state = fetcher.data;
  const wrong = !!state && "wrong" in state && typed.for !== state;
  const busy = fetcher.state !== "idle";
  const emailState = state && "emailState" in state ? state.emailState : undefined;
  const problem = state && "problem" in state ? state.problem : undefined;
  const handled = useRef<StepUpState | undefined>(undefined);

  useEffect(() => {
    if (!state || handled.current === state) return;
    handled.current = state;
    if (state.view === "verified") {
      onVerified();
      return;
    }
    if ("passkey" in state) {
      const { options, webauthnSessionId } = state.passkey;
      void getAssertion(options)
        .then((credentialJson) =>
          fetcher.submit(
            { credentialJson, intent: "verify", kind: "passkey", webauthnSessionId },
            { action: STEP_UP_ROUTE, method: "post" },
          ),
        )
        .catch(() => setFactor("totp"));
    }
  }, [state, fetcher, onVerified]);

  useEffect(() => {
    input.current?.focus();
  }, [factor, wrong]);

  const send = (fields: Record<string, string>) =>
    void fetcher.submit(fields, { action: STEP_UP_ROUTE, method: "post" });

  const verify = (code: string) => send({ code, intent: "verify", kind: factor });

  const pick = (f: Factor) => {
    setFactor(f);
    setTyped({ code: "", for: state });
    if (f === "email" && !emailState) send({ intent: "email" });
    if (f === "passkey") send({ intent: "passkey-begin" });
  };

  const options = [
    { label: "Authenticator", value: "totp" as const },
    { label: "Email", value: "email" as const },
    ...(client && passkeysSupported() ? [{ label: "Passkey", value: "passkey" as const }] : []),
  ];

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (typed.code.length === 6) verify(typed.code);
      }}
    >
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      {children}
      <Segmented label="Second factor" onChange={pick} options={options} value={factor} />
      {factor === "email" && (
        <Alert tone="info">
          {emailState === "wait"
            ? "A code was sent a moment ago. Wait a little, then ask for another. "
            : emailState === "sent"
              ? "We emailed you a code. It works for 10 minutes. "
              : "We'll email a code to the address on your account. "}
          <button
            className="font-bold text-primary hover:text-ink"
            onClick={() => send({ intent: "email" })}
            type="button"
          >
            {emailState ? "Resend code" : "Send code"}
          </button>
        </Alert>
      )}
      {problem && <Alert tone="danger">{PROBLEMS[problem]}</Alert>}
      {factor === "passkey" ? (
        <Button
          block
          loading={busy}
          loadingLabel="Waiting for your passkey…"
          onClick={() => send({ intent: "passkey-begin" })}
          variant="secondary"
        >
          <KeyRound aria-hidden />
          Use a passkey
        </Button>
      ) : (
        <>
          <CodeInput
            aria-describedby={wrong ? "step-up-wrong" : undefined}
            invalid={wrong}
            onChange={(code) => setTyped({ code, for: state })}
            onComplete={verify}
            ref={input}
            size="md"
            value={typed.code}
          />
          {wrong && (
            <span
              className="text-[0.875rem] leading-[1.3] font-bold text-danger"
              id="step-up-wrong"
              role="alert"
            >
              <X aria-hidden className="mr-1 inline size-3.5 align-[-2px]" strokeWidth={3} />
              That code didn&apos;t work. Try again.
            </span>
          )}
        </>
      )}
      <DialogFooter>
        <Button onClick={onCancel} variant="secondary">
          Cancel
        </Button>
        {factor !== "passkey" && (
          <Button
            disabled={typed.code.length !== 6}
            loading={busy}
            loadingLabel="Checking…"
            type="submit"
          >
            {confirmLabel}
          </Button>
        )}
      </DialogFooter>
    </form>
  );
};

/**
 * Wire a page to the prompt: `ask(retry)` opens it, and once the factor checks out the
 * prompt closes and `retry` runs (usually resubmitting the form that was refused).
 */
export const useStepUp = () => {
  const [retry, setRetry] = useState<(() => void) | null>(null);
  return {
    ask: (next: () => void) => setRetry(() => next),
    dialog: {
      onOpenChange: (open: boolean) => {
        if (!open) setRetry(null);
      },
      onVerified: () => {
        const next = retry;
        setRetry(null);
        next?.();
      },
      open: retry !== null,
    },
  };
};
