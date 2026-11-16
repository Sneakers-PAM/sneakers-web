import {
  createLogger,
  TargetsListDocument,
  TargetsPinTlsCertificateDocument,
  TargetsScanTlsCertificateDocument,
  type TargetsScanTlsCertificateQuery,
} from "@sneakers-web/api-client";
import { type ActionFunctionArgs, data } from "react-router";

import { type Refusal, refusalOf } from "#shell/refusal";
import { requireUser } from "#shell/server/session.server";

const log = createLogger("tls-cert-pin");

/** What the pin dialog shows after each post: the scan, the pin, or why not. */
export type TlsCertPinState =
  | {
      /** The SHA-256 fingerprints the target pins now (64 lowercase hex), to show beside a change. */
      pinnedFingerprints: string[];
      scan: TlsCertScanView;
      view: "scanned";
    }
  | { fingerprint: string; view: "pinned" }
  | { refusal: Refusal; view: "problem" };

export type TlsCertScanView = TargetsScanTlsCertificateQuery["scanTargetTlsCertificate"];

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

/** A fingerprint as 64 lowercase hex digits, however the vault or a person wrote it. */
export const tlsFingerprint = (raw: string): string =>
  raw
    .trim()
    .replace(/^sha256:/i, "")
    .replaceAll(":", "")
    .toLowerCase();

/**
 * The TLS pin dialog's resource action: scan a target's offered certificate chain, or pin exactly
 * the fingerprint the person confirmed. A scan never pins; the gateway checks the person may pin
 * (a site admin, or the owner of a personal target), that the target still sends that
 * certificate and that pinning it alone would work, before it pins anything. Certificates are
 * public, but only the target and counts are logged here, never the chain itself.
 */
export const tlsCertPinAction = async ({ request }: ActionFunctionArgs) => {
  const { gw } = await requireUser(request);
  const form = await request.formData();
  const intent = text(form, "intent");
  const targetId = text(form, "targetId");
  log.debug("tls cert pin step", { intent, targetId });
  try {
    if (intent === "scan") {
      const { scanTargetTlsCertificate } = await gw.gql(TargetsScanTlsCertificateDocument, {
        targetId,
      });
      const { targets } = await gw.gql(TargetsListDocument);
      const pinnedFingerprints = (targets.find((t) => t.id === targetId)?.tlsCertPins ?? []).map(
        (pin) => tlsFingerprint(pin),
      );
      log.info("tls certificate scanned", {
        certificates: scanTargetTlsCertificate.chain.length,
        pinnable: scanTargetTlsCertificate.chain.filter((c) => c.pinnable).length,
        pinned: pinnedFingerprints.length,
        targetId,
      });
      return data<TlsCertPinState>({
        pinnedFingerprints,
        scan: scanTargetTlsCertificate,
        view: "scanned",
      });
    }
    if (intent === "pin") {
      const fingerprint = tlsFingerprint(text(form, "fingerprint"));
      await gw.gql(TargetsPinTlsCertificateDocument, { fingerprint, targetId });
      log.info("tls certificate pinned", { targetId });
      return data<TlsCertPinState>({ fingerprint, view: "pinned" });
    }
  } catch (error) {
    const refusal = refusalOf(error);
    if (!refusal) {
      log.error("tls cert pin step failed", { intent, targetId });
      throw error;
    }
    log.warn("tls cert pin step refused", {
      code: refusal.code,
      intent,
      reason: refusal.reason,
      targetId,
    });
    return data<TlsCertPinState>({ refusal, view: "problem" });
  }
  throw data("Unknown intent", { status: 400 });
};
