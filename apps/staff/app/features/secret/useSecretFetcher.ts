import { refusalMessage } from "@sneakers-web/shell";
import { toast } from "@sneakers-web/ui";
import { useEffect, useRef } from "react";
import { useFetcher } from "react-router";

import type { SecretActionResult } from "@/features/secret/secret.server";

/**
 * A form on the detail page, posting to the page's action. Each new answer is toasted once:
 * the note when it worked, the reason when it didn't (unless the caller handles refusals).
 */
export const useSecretFetcher = ({ quiet = false }: { quiet?: boolean } = {}) => {
  const fetcher = useFetcher<SecretActionResult>();
  const shown = useRef<SecretActionResult | undefined>(undefined);
  const result = fetcher.data;
  useEffect(() => {
    if (!result || shown.current === result) return;
    shown.current = result;
    if (result.ok) {
      if (result.done) toast(result.done);
    } else if (!quiet) {
      toast.error(refusalMessage(result.refusal));
    }
  }, [quiet, result]);
  return fetcher;
};
