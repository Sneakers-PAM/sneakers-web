import {
  needsStepUp,
  refusalMessage,
  type StepUpDialogProps,
  useStepUp,
} from "@sneakers-web/shell";
import { toast } from "@sneakers-web/ui";
import { useCallback, useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";

import type { SecretActionResult, SecretLoad } from "@/features/secret/secret.server";

import { useRevealRunId } from "@/features/secret/revealRun";

export interface QuickCopyTarget {
  fieldKey: string;
  label: string;
  secretId: string;
  /** A plain field copies its already-readable value; only a sensitive one needs a reveal. */
  sensitive: boolean;
}

const writeToClipboard = (label: string, value: string, logged: boolean) =>
  void navigator.clipboard
    .writeText(value)
    .then(() => toast(`${label} copied.${logged ? " This is logged." : ""}`))
    .catch(() => toast.error("Couldn't copy. Open the secret and copy it by hand."));

/**
 * Quick copy from a browse row, without opening the secret.
 *
 * A sensitive field (the type's main value) goes through the same audited reveal-for-copy the
 * secret page uses (`intent: "reveal"`, `purpose: "copy"`), posted straight to that secret's
 * own route, with the vault's step-up rule still applying. An approval-held reveal just points
 * the person at the secret page to follow it, rather than polling from the grid.
 *
 * A plain field (the identity field) is never revealed or audited, same as the secret page's
 * plain fields: this loads the secret's own page data and copies the value already in it.
 */
export const useQuickCopy = (): {
  copy: (target: QuickCopyTarget) => void;
  dialog: StepUpDialogProps;
} => {
  const reveal = useFetcher<SecretActionResult>();
  const plain = useFetcher<SecretLoad>();
  const stepUp = useStepUp();
  const runId = useRevealRunId();
  const [target, setTarget] = useState<null | QuickCopyTarget>(null);
  const handledReveal = useRef<SecretActionResult | undefined>(undefined);
  const handledPlain = useRef<SecretLoad | undefined>(undefined);

  const sendReveal = useCallback(
    (t: QuickCopyTarget) =>
      void reveal.submit(
        { fieldKey: t.fieldKey, intent: "reveal", purpose: "copy", runId },
        { action: `/secret/${t.secretId}`, method: "post" },
      ),
    [reveal, runId],
  );

  const copy = useCallback(
    (t: QuickCopyTarget) => {
      setTarget(t);
      if (t.sensitive) sendReveal(t);
      else plain.load(`/secret/${t.secretId}`);
    },
    [plain, sendReveal],
  );

  useEffect(() => {
    const result = reveal.data;
    if (!result || handledReveal.current === result || !target) return;
    handledReveal.current = result;
    if (!result.ok) {
      if (needsStepUp(result.refusal)) {
        stepUp.ask(() => sendReveal(target));
        return;
      }
      toast.error(refusalMessage(result.refusal));
      return;
    }
    if (result.pendingUse) {
      toast(
        `${target.label} needs another owner's or an approver's approval. Open the secret to follow it.`,
      );
      return;
    }
    if (result.value === undefined) return;
    writeToClipboard(target.label, result.value, true);
  }, [reveal.data, sendReveal, stepUp, target]);

  useEffect(() => {
    const result = plain.data;
    if (!result || handledPlain.current === result || !target) return;
    handledPlain.current = result;
    if (!result.ok) {
      toast.error(result.failure.message);
      return;
    }
    const value = result.fields[target.fieldKey];
    if (value === undefined) {
      toast.error("Couldn't copy. Open the secret and copy it by hand.");
      return;
    }
    writeToClipboard(target.label, value, false);
  }, [plain.data, target]);

  return {
    copy,
    dialog: {
      ...stepUp.dialog,
      description: target
        ? `Copying ${target.label} needs a fresh second factor.`
        : "This needs a fresh second factor.",
    },
  };
};
