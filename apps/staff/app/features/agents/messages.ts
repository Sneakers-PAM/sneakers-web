import { type Refusal, refusalMessage } from "@sneakers-web/shell";

const sentence = (text: string): string => {
  const t = text.trim();
  if (!t) return "That didn't work. Try again.";
  const s = t.charAt(0).toUpperCase() + t.slice(1);
  return /[.!?]$/.test(s) ? s : `${s}.`;
};

/**
 * The sentence for an agents refusal. The gateway's own factor and token checks come back
 * with no code or reason, only their text, so that text is the message.
 */
export const agentRefusalMessage = (r: Refusal): string =>
  !r.code && !r.reason ? sentence(r.detail) : refusalMessage(r);
