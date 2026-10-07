import { clockTime, plural } from "@sneakers-web/ui";

import { refusalOf } from "@/lib/osadmin/errors";

/**
 * One plain sentence for a refused sign-in, step-up or one-time code: the tries left, the
 * lockout's end, or this address's wait. `what` picks the opening: a sign-in checks the name,
 * the password and the code; a step-up or a code page checks only the code.
 */
export const refusalMessage = (
  error: unknown,
  { what, who }: { what: "code" | "sign-in"; who?: string },
): string => {
  const refusal = refusalOf(error);
  const account = who || "This account";
  if (refusal?.retryAfter)
    return `Too many tries from this address. Try again at ${clockTime(refusal.retryAfter)}.`;
  if (refusal?.lockedUntilUnlocked) return `${account} is locked until an owner unlocks it.`;
  if (refusal?.lockedUntil) return `${account} is locked until ${clockTime(refusal.lockedUntil)}.`;
  const opening =
    what === "sign-in"
      ? "That didn't work. Check the name, the password and the code."
      : "That code didn't work. Type a new one from your authenticator.";
  if (refusal && refusal.attemptsLeft > 0)
    return `${opening} ${plural(refusal.attemptsLeft, "try", "tries")} left before the account locks.`;
  if (refusal) return opening;
  return error instanceof Error ? error.message : "The appliance refused.";
};
