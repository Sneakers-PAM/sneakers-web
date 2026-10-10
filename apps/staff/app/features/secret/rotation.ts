import type { SecretPage } from "@/features/secret/secret.server";

export type NotRotating = "no-connection" | "no-target" | "opted-out";

/**
 * Why the vault won't rotate this secret, or null when it will (or the type can't rotate at all).
 * The vault schedules rotation only for a secret whose target has a connection.
 */
export const notRotating = ({ secret, target, type }: SecretPage): NotRotating | null => {
  if (!type?.rotation) return null;
  if (secret.rotationOptOut) return "opted-out";
  if (!secret.targetId || !target) return "no-target";
  if (!target.connectionId) return "no-connection";
  return null;
};

/** One line on why, for the details card. */
export const notRotatingDetail = (reason: NotRotating, targetName = "") => {
  if (reason === "opted-out") return "Rotation is turned off for this secret.";
  if (reason === "no-target") return "It has no target to rotate on.";
  return `Its target, ${targetName}, has no connection.`;
};
