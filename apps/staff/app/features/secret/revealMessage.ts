import { type Refusal, refusalMessage } from "@sneakers-web/shell";

/**
 * A refused reveal, in one sentence. The vault doesn't refuse a reveal for a missing lease yet,
 * so CHECKOUT_REQUIRED is the mock's own reason and its message stays here. It moves to the
 * shared messages once the vault refuses this under its own reason.
 */
export const revealMessage = (refusal: Refusal): string =>
  refusal.reason === "CHECKOUT_REQUIRED"
    ? "Check this secret out first, then reveal it."
    : refusalMessage(refusal);
