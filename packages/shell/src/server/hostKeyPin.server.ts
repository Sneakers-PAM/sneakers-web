import {
  createLogger,
  TargetsListDocument,
  TargetsPinHostKeyDocument,
  TargetsScanHostKeyDocument,
  type TargetsScanHostKeyQuery,
} from "@sneakers-web/api-client";
import { createHash } from "node:crypto";
import { type ActionFunctionArgs, data } from "react-router";

import { type Refusal, refusalOf } from "#shell/refusal";
import { requireUser } from "#shell/server/session.server";

const log = createLogger("host-key-pin");

/** What the pin dialog shows after each post: the scan, the pin, or why not. */
export type HostKeyPinState =
  | {
      /** The SHA256 fingerprints the target pins now, to show beside a key that changed. */
      pinnedFingerprints: string[];
      scan: HostKeyScanView;
      view: "scanned";
    }
  | { publicKey: string; view: "pinned" }
  | { refusal: Refusal; view: "problem" };

export type HostKeyScanView = TargetsScanHostKeyQuery["scanTargetHostKey"];

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

/** An authorized_keys line's SHA256 fingerprint, as ssh-keygen -l prints it. */
export const hostKeyFingerprint = (line: string): string => {
  const blob = line.trim().split(/\s+/, 2)[1] ?? "";
  const digest = createHash("sha256").update(Buffer.from(blob, "base64")).digest("base64");
  return `SHA256:${digest.replace(/=+$/, "")}`;
};

/**
 * The host-key pin dialog's resource action: scan a target's offered key, or pin exactly the
 * fingerprint the person confirmed. A scan never pins; the gateway checks the person may pin
 * (a site admin, or the owner of a personal target) and that the fingerprint still matches
 * before it pins anything.
 */
export const hostKeyPinAction = async ({ request }: ActionFunctionArgs) => {
  const { gw } = await requireUser(request);
  const form = await request.formData();
  const intent = text(form, "intent");
  const targetId = text(form, "targetId");
  log.debug("host key pin step", { intent, targetId });
  try {
    if (intent === "scan") {
      const { scanTargetHostKey } = await gw.gql(TargetsScanHostKeyDocument, { targetId });
      const { targets } = await gw.gql(TargetsListDocument);
      const pinnedFingerprints = (targets.find((t) => t.id === targetId)?.sshHostKeys ?? []).map(
        (key) => hostKeyFingerprint(key),
      );
      log.info("host key scanned", {
        changed: !scanTargetHostKey.pinned && pinnedFingerprints.length > 0,
        pinned: scanTargetHostKey.pinned,
        targetId,
      });
      return data<HostKeyPinState>({
        pinnedFingerprints,
        scan: scanTargetHostKey,
        view: "scanned",
      });
    }
    if (intent === "pin") {
      const fingerprint = text(form, "fingerprint");
      const publicKey = text(form, "publicKey");
      await gw.gql(TargetsPinHostKeyDocument, { fingerprint, targetId });
      log.info("host key pinned", { targetId });
      return data<HostKeyPinState>({ publicKey, view: "pinned" });
    }
  } catch (error) {
    const refusal = refusalOf(error);
    if (!refusal) throw error;
    log.warn("host key pin step refused", { code: refusal.code, intent, targetId });
    return data<HostKeyPinState>({ refusal, view: "problem" });
  }
  throw data("Unknown intent", { status: 400 });
};
