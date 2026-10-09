import { toast } from "@sneakers-web/ui";

import { isNotAvailable, isStepUpRequired } from "@/lib/osadmin/errors";
import { requestStepUp, type StepUpFollowUp } from "@/lib/osadmin/stepUpController";

interface ActionOptions<T> {
  /**
   * After a step-up, a question the step-up dialog asks next about the result, instead of
   * closing; undefined closes it as usual.
   */
  afterStepUp?: (result: T) => StepUpFollowUp | undefined;
  onSuccess?: (result: T) => void;
  successMessage?: string;
}

const attempt = async <T>(
  fn: () => Promise<T>,
  options: ActionOptions<T> | undefined,
  steppedUp: boolean,
): Promise<StepUpFollowUp | undefined> => {
  try {
    const result = await fn();
    options?.onSuccess?.(result);
    if (options?.successMessage) toast(options.successMessage);
    return steppedUp ? options?.afterStepUp?.(result) : undefined;
  } catch (error) {
    if (isStepUpRequired(error)) {
      requestStepUp(() => attempt(fn, options, true));
      return;
    }
    if (isNotAvailable(error)) {
      toast("Not available in this release.");
      return;
    }
    toast(error instanceof Error ? error.message : "Something went wrong.");
  }
};

/**
 * Runs a mutating call, and turns its two special refusals into the right UI instead of a
 * plain error: a step-up queues the action behind the step-up dialog and retries it once
 * approved, and an unimplemented backend says plainly that the page isn't available yet.
 */
export const runAction = async <T>(
  fn: () => Promise<T>,
  options?: ActionOptions<T>,
): Promise<void> => {
  await attempt(fn, options, false);
};
