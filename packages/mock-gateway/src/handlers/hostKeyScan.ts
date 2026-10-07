import { createHash } from "node:crypto";

import type { MockTarget } from "#mock/fixtures/world";

/**
 * Trust-on-first-use host-key pinning, mocked: the key a target "offers" is deterministic (its
 * fixture's own `offeredHostKey`, or a key derived from the target's id when it hasn't scanned
 * before), so a repeat scan always reports the same fingerprint. Nothing here pins a key; only
 * the caller's pin mutation does.
 */

/** The authorized_keys line the target's host would offer on a fresh scan. */
export const offeredKeyLine = (t: MockTarget): string =>
  t.offeredHostKey ?? `ssh-ed25519 ${createHash("sha256").update(t.id).digest("base64")} mock-scan`;

/** An authorized_keys line split into its key type and "type blob" public key, no comment. */
export const parseKeyLine = (line: string): { keyType: string; publicKey: string } => {
  const [keyType = "ssh-ed25519", blob = ""] = line.trim().split(/\s+/);
  return { keyType, publicKey: `${keyType} ${blob}` };
};

/** The key's SHA256 fingerprint, as ssh-keygen -l prints it. */
export const fingerprintOf = (line: string): string => {
  const [, blob = ""] = line.trim().split(/\s+/);
  const digest = createHash("sha256")
    .update(Buffer.from(blob, "base64"))
    .digest("base64")
    .replace(/=+$/, "");
  return `SHA256:${digest}`;
};
