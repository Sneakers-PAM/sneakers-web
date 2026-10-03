import { refusalMessage } from "@sneakers-web/shell";
import {
  Button,
  clockTime,
  CodeInput,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Textarea,
  toast,
} from "@sneakers-web/ui";
import { Copy, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { type FetcherWithComponents } from "react-router";

import type { SecretActionResult, SecretType } from "@/features/secret/secret.server";

import { Panel } from "@/features/secret/Panel";

type Fetcher = FetcherWithComponents<SecretActionResult>;

/** D-03: a reason and a fresh authenticator code, then every field is shown. */
export const BreakGlassDialog = ({
  fetcher,
  name,
  onOpenChange,
  open,
}: {
  fetcher: Fetcher;
  name: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) => (
  <Dialog onOpenChange={onOpenChange} open={open}>
    <DialogContent>
      {open && (
        <BreakGlassForm fetcher={fetcher} name={name} onCancel={() => onOpenChange(false)} />
      )}
    </DialogContent>
  </Dialog>
);

/** The form, mounted afresh on every opening so a reason or code never lingers. */
const BreakGlassForm = ({
  fetcher,
  name,
  onCancel,
}: {
  fetcher: Fetcher;
  name: string;
  onCancel: () => void;
}) => {
  const [reason, setReason] = useState("");
  // The answer the current code was typed after: a refusal only marks the code it refused.
  const [code, setCode] = useState<{ after: SecretActionResult | undefined; value: string }>({
    after: fetcher.data,
    value: "",
  });
  const [opened] = useState(() => fetcher.data);
  const result =
    fetcher.data !== opened && fetcher.data?.intent === "break-glass" ? fetcher.data : undefined;
  const refusal = result && !result.ok && code.after !== result ? result.refusal : undefined;
  // The gateway checks the code itself and refuses a bad one with no reason (and, live, no code).
  const wrongCode = !!refusal && (!refusal.code || refusal.code === "UNAUTHENTICATED");
  const busy = fetcher.state !== "idle";

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        void fetcher.submit(
          { code: code.value, intent: "break-glass", reason },
          { method: "post" },
        );
      }}
    >
      <DialogHeader>
        <DialogTitle className="flex items-center gap-3">
          <span className="inline-flex size-11 items-center justify-center rounded-lg bg-danger text-on-danger">
            <TriangleAlert aria-hidden className="size-5" />
          </span>
          Break glass on {name}?
        </DialogTitle>
        <DialogDescription asChild>
          <ul className="m-0 flex list-none flex-col gap-2 rounded-lg border-[1.5px] border-danger bg-danger-soft p-4 text-[0.875rem] text-ink">
            <li>
              <b>Every field is revealed</b>, skipping checkout and pending approvals.
            </li>
            <li>
              <b>The folder&apos;s owners are notified</b> straight away.
            </li>
            <li>
              <b>The secret is queued for rotation</b> once you&apos;re done.
            </li>
            <li>
              This is recorded as a <b>high-severity</b> event.
            </li>
          </ul>
        </DialogDescription>
      </DialogHeader>
      <Field label="Reason" required>
        <Textarea
          name="reason"
          onChange={(event) => setReason(event.target.value)}
          placeholder="What is the emergency?"
          value={reason}
        />
      </Field>
      <div className="flex flex-col gap-2">
        <span className="text-[0.875rem] font-bold">
          Authenticator code <span className="text-danger">*</span>
        </span>
        <CodeInput
          aria-describedby={refusal ? "break-glass-refused" : undefined}
          invalid={wrongCode}
          onChange={(value) => setCode({ after: fetcher.data, value })}
          size="md"
          value={wrongCode ? "" : code.value}
        />
      </div>
      {refusal && (
        <span className="text-small font-bold text-danger" id="break-glass-refused" role="alert">
          {wrongCode ? "That code didn't work. Try again." : refusalMessage(refusal)}
        </span>
      )}
      <DialogFooter>
        <Button onClick={onCancel} variant="secondary">
          Cancel
        </Button>
        <Button
          disabled={!reason.trim() || code.value.length !== 6 || wrongCode}
          loading={busy}
          loadingLabel="Breaking glass…"
          type="submit"
          variant="danger"
        >
          Break glass
        </Button>
      </DialogFooter>
    </form>
  );
};

/** The red card holding every field after break glass, until it's ended or the page is left. */
export const BreakGlassCard = ({
  at,
  by,
  fields,
  onEnd,
  type,
}: {
  at: number;
  by: string;
  fields: { key: string; value: string }[];
  onEnd: () => void;
  type: null | SecretType;
}) => {
  const label = (key: string) => type?.fields.find((f) => f.key === key)?.label ?? key;
  const order = (key: string) => {
    const index = type?.fields.findIndex((f) => f.key === key) ?? -1;
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  };
  return (
    <Panel
      subtitle={`High-severity action recorded at ${clockTime(at)} by ${by}. The owners were notified and a rotation is queued.`}
      title="Break-glass reveal"
      tone="danger"
    >
      {fields
        .toSorted((a, b) => order(a.key) - order(b.key))
        .map((f) => (
          <div
            className="grid items-center gap-2 border-b border-border px-6 py-3 tablet:grid-cols-[9rem_minmax(0,1fr)_auto]"
            key={f.key}
          >
            <span className="text-small font-bold text-muted">{label(f.key)}</span>
            <span className="min-w-0 font-mono text-value break-all whitespace-pre-wrap">
              {f.value}
            </span>
            <Button
              aria-label={`Copy ${label(f.key)}`}
              onClick={() =>
                void navigator.clipboard
                  .writeText(f.value)
                  .then(() => toast(`${label(f.key)} copied. This is logged.`))
                  .catch(() => toast.error("Couldn't copy."))
              }
              size="sm"
              variant="secondary"
            >
              <Copy aria-hidden />
              Copy
            </Button>
          </div>
        ))}
      <div className="flex flex-wrap items-center gap-3 px-6 py-4">
        <span className="text-small text-muted">
          Values stay visible until you leave this page.
        </span>
        <Button className="ml-auto" onClick={onEnd} size="sm" variant="secondary">
          Hide and end
        </Button>
      </div>
    </Panel>
  );
};
