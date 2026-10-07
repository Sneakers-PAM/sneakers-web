import {
  createLogger,
  TargetsPinHostKeyDocument,
  TargetsScanHostKeyDocument,
  type TargetsScanHostKeyQuery,
} from "@sneakers-web/api-client";
import { type ActionFunctionArgs, data } from "react-router";

import { type Refusal, refusalOf } from "#shell/refusal";
import { requireUser } from "#shell/server/session.server";

const log = createLogger("host-key-pin");

/** What the pin dialog shows after each post: the scan, the pin, or why not. */
export type HostKeyPinState =
  | { publicKey: string; view: "pinned" }
  | { refusal: Refusal; view: "problem" }
  | { scan: HostKeyScanView; view: "scanned" };

export type HostKeyScanView = TargetsScanHostKeyQuery["scanTargetHostKey"];

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

/**
 * The host-key pin dialog's resource action: scan a target's offered key, or pin exactly the
 * fingerprint the person confirmed. A scan never pins; the gateway checks site admin or root
 * and that the fingerprint still matches before it pins anything.
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
      log.info("host key scanned", { pinned: scanTargetHostKey.pinned, targetId });
      return data<HostKeyPinState>({ scan: scanTargetHostKey, view: "scanned" });
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
