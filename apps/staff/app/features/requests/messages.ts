import { type Refusal, refusalMessage } from "@sneakers-web/shell";

// The workflow service doesn't send REQUEST_NOT_PENDING yet; only the mock gateway does. Once
// the workflow refuses resolving a decided request with this reason, it belongs in the shell's
// shared messages.
const NOT_PENDING = "REQUEST_NOT_PENDING";

/** One plain sentence for a refusal on the requests and checkouts screens. */
export const requestRefusalMessage = (r: Refusal): string =>
  r.reason === NOT_PENDING ? "Someone already decided this request." : refusalMessage(r);
