import { getAssertion, passkeysSupported } from "@sneakers-web/api-client";
import {
  Alert,
  Button,
  cn,
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

import type { AgentsResult } from "@/features/agents/model";

export interface FactorDialogProps {
  /** Where the page's action answers, such as "/approvals". */
  action: string;
  confirmLabel: string;
  description?: ReactNode;
  /** The form the factor is sent with: the intent and what it acts on. */
  fields: Record<string, string>;
  /** Said after a refused factor, such as "Nothing was approved." */
  nothingDone: string;
  onDone: (result: Extract<AgentsResult, { ok: true }>) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  /** A reveal to the agent: warn, and make the confirm button the danger one. */
  reveal?: ReactNode;
  summary: SummaryLine[];
  title: ReactNode;
}

export interface SummaryLine {
  label: string;
  mono?: boolean;
  value: ReactNode;
}

type Factor = "email" | "passkey" | "totp";

/**
 * Asks for a second factor and sends it with the action itself. Approving a use and
 * creating a grant check the factor in the same call (the gateway's requireFactor), not
 * through a session step-up, so the shared step-up prompt can't carry them.
 */
export const FactorDialog = (props: FactorDialogProps) => (
  <Dialog onOpenChange={props.onOpenChange} open={props.open}>
    <DialogContent>{props.open && <Prompt {...props} />}</DialogContent>
  </Dialog>
);

const Prompt = ({
  action,
  confirmLabel,
  description,
  fields,
  nothingDone,
  onDone,
  onOpenChange,
  reveal,
  summary,
  title,
}: FactorDialogProps) => {
  const fetcher = useFetcher<AgentsResult>();
  const email = useFetcher<AgentsResult>();
  const client = useIsClient();
  const input = useRef<HTMLInputElement>(null);
  const [factor, setFactor] = useState<Factor>("totp");
  const [code, setCode] = useState("");
  // A refusal stays shown until the person edits or switches factor past it.
  const [dismissed, setDismissed] = useState<AgentsResult | undefined>();
  const [passkeyFailed, setPasskeyFailed] = useState(false);
  const handled = useRef<AgentsResult | undefined>(undefined);
  const busy = fetcher.state !== "idle";
  const emailSent = !!email.data?.ok;

  const failed =
    fetcher.data && !fetcher.data.ok && fetcher.data !== dismissed ? fetcher.data : undefined;
  const problem = passkeyFailed
    ? { factor: true, text: "The passkey step didn't finish. Try again, or use a code." }
    : failed
      ? {
          factor: failed.factorRejected,
          text: failed.factorRejected ? `${failed.message} ${nothingDone}` : failed.message,
        }
      : email.data && !email.data.ok
        ? { factor: false, text: email.data.message }
        : null;

  const send = (extra: Record<string, string>) =>
    void fetcher.submit({ ...fields, ...extra }, { action, method: "post" });
  const sendEmail = () => void email.submit({ intent: "factor-email" }, { action, method: "post" });
  const clear = () => {
    setDismissed(fetcher.data);
    setPasskeyFailed(false);
  };

  useEffect(() => {
    const d = fetcher.data;
    if (!d?.ok || handled.current === d) return;
    handled.current = d;
    if (d.intent === "factor-passkey" && d.passkey) {
      const { options, webauthnSessionId } = d.passkey;
      void getAssertion(options)
        .then((credentialJson) =>
          fetcher.submit(
            { ...fields, credentialJson, factor: "passkey", webauthnSessionId },
            { action, method: "post" },
          ),
        )
        .catch(() => {
          setFactor("totp");
          setPasskeyFailed(true);
        });
      return;
    }
    onDone(d);
  }, [fetcher, fetcher.data, fields, action, onDone]);

  useEffect(() => {
    input.current?.focus();
  }, [factor]);

  const pick = (f: Factor) => {
    setFactor(f);
    setCode("");
    clear();
    if (f === "email" && !emailSent) sendEmail();
  };

  const options = [
    { label: "Authenticator", value: "totp" as const },
    { label: "Email", value: "email" as const },
    ...(client && passkeysSupported() ? [{ label: "Passkey", value: "passkey" as const }] : []),
  ];
  const wrong = !!problem?.factor;

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (factor === "passkey") send({ intent: "factor-passkey" });
        else if (code.length === 6) send({ code, factor });
      }}
    >
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
      </DialogHeader>
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
      {reveal && <Alert tone="danger">{reveal}</Alert>}
      <Segmented label="Second factor" onChange={pick} options={options} value={factor} />
      {factor === "email" && (
        <Alert tone="info">
          {emailSent
            ? "We emailed you a code. "
            : "We'll email a code to the address on your account. "}
          <button
            className="font-bold text-primary hover:text-ink"
            onClick={sendEmail}
            type="button"
          >
            {emailSent ? "Resend code" : "Send code"}
          </button>
        </Alert>
      )}
      {factor === "passkey" ? (
        <Alert tone="info">Your browser asks for your passkey when you press the button.</Alert>
      ) : (
        <CodeInput
          aria-describedby={problem ? "factor-problem" : undefined}
          invalid={wrong}
          onChange={(next) => {
            setCode(next);
            clear();
          }}
          ref={input}
          size="md"
          value={code}
        />
      )}
      {problem && (
        <span
          className="text-[0.875rem] leading-[1.3] font-bold text-danger"
          id="factor-problem"
          role="alert"
        >
          <X aria-hidden className="mr-1 inline size-3.5 align-[-2px]" strokeWidth={3} />
          {problem.text}
        </span>
      )}
      <DialogFooter>
        <Button onClick={() => onOpenChange(false)} variant="secondary">
          Cancel
        </Button>
        <Button
          disabled={factor !== "passkey" && code.length !== 6}
          loading={busy}
          loadingLabel="Checking…"
          type="submit"
          variant={reveal ? "danger" : "primary"}
        >
          {factor === "passkey" && <KeyRound aria-hidden />}
          {factor === "passkey" ? "Use passkey" : confirmLabel}
        </Button>
      </DialogFooter>
    </form>
  );
};
