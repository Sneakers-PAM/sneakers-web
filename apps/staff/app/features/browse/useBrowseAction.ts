import { refusalMessage } from "@sneakers-web/shell";
import { toast } from "@sneakers-web/ui";
import { useEffect, useRef } from "react";
import { useFetcher } from "react-router";

import type { BrowseResult } from "@/features/browse/types";

/**
 * Post one change to the browse route's action. On success it toasts the outcome and calls
 * `onDone`; a refusal stays on screen as `error`, in plain words.
 */
export const useBrowseAction = (onDone?: () => void) => {
  const fetcher = useFetcher<BrowseResult>();
  const seen = useRef<BrowseResult | undefined>(undefined);
  const result = fetcher.data;

  useEffect(() => {
    if (fetcher.state !== "idle" || !result || result === seen.current) return;
    seen.current = result;
    if (result.ok) {
      toast(result.done);
      onDone?.();
    }
  }, [fetcher.state, onDone, result]);

  return {
    busy: fetcher.state !== "idle",
    error: result && !result.ok ? refusalMessage(result.refusal) : null,
    submit: (fields: Record<string, string>) => void fetcher.submit(fields, { method: "post" }),
  };
};
