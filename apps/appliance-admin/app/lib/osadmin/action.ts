import { toast } from "@sneakers-web/ui";

import { isNotAvailable, isStepUpRequired } from "@/lib/osadmin/errors";
import { requestStepUp } from "@/lib/osadmin/stepUpController";

/**
 * Runs a mutating call, and turns its two special refusals into the right UI instead of a
 * plain error: a step-up queues the action behind the step-up dialog and retries it once
 * approved, and an unimplemented backend says plainly that the page isn't available yet.
 */
export const runAction = async <T>(
  fn: () => Promise<T>,
  options?: { onSuccess?: (result: T) => void; successMessage?: string },
): Promise<void> => {
  try {
    const result = await fn();
    options?.onSuccess?.(result);
    if (options?.successMessage) toast(options.successMessage);
  } catch (error) {
    if (isStepUpRequired(error)) {
      requestStepUp(() => void runAction(fn, options));
      return;
    }
    if (isNotAvailable(error)) {
      toast("Not available in this release.");
      return;
    }
    toast(error instanceof Error ? error.message : "Something went wrong.");
  }
};
