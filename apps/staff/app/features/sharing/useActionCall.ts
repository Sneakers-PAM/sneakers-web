import { useCallback, useEffect, useRef } from "react";
import { useFetcher } from "react-router";

import type { SharingResult } from "@/features/sharing/types";

interface Waiting {
  reject: (error: Error) => void;
  resolve: (result: SharingResult) => void;
}

/**
 * Post one intent to this page's action and get its answer as a promise, for the editor's and
 * simulator's typeahead and simulation. A newer call supersedes an older one still waiting.
 */
export const useActionCall = () => {
  const fetcher = useFetcher<SharingResult>();
  const waiting = useRef<null | Waiting>(null);
  const { data, state, submit } = fetcher;

  useEffect(() => {
    if (state !== "idle" || !waiting.current) return;
    const w = waiting.current;
    waiting.current = null;
    if (data) w.resolve(data);
    else w.reject(new Error("no answer"));
  }, [data, state]);

  return useCallback(
    (fields: Record<string, string>) =>
      new Promise<SharingResult>((resolve, reject) => {
        waiting.current?.reject(new Error("superseded"));
        waiting.current = { reject, resolve };
        void submit(fields, { method: "post" });
      }),
    [submit],
  );
};
