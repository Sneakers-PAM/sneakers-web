import { createLogger, fetchSetupState } from "@sneakers-web/api-client";
import { useCallback, useEffect, useRef, useState } from "react";

const log = createLogger("gateway-probe");

export const AUTO_RETRY_SECONDS = 20;

export type Probe =
  | { needsSetup: boolean; phase: "ready" }
  | { phase: "checking" }
  | { phase: "offline"; retrying: boolean; triedAt: Date };

/**
 * Ask the gateway whether it is up and set up. Offline retries itself every 20 seconds;
 * `retry` tries at once.
 */
export const useGatewayProbe = (): { probe: Probe; retry: () => void } => {
  const [probe, setProbe] = useState<Probe>({ phase: "checking" });
  const [attempt, setAttempt] = useState(0);
  const ran = useRef(-1);

  useEffect(() => {
    if (ran.current === attempt) return;
    ran.current = attempt;
    let cancelled = false;
    const started = performance.now();
    setProbe((p) => (p.phase === "offline" ? { ...p, retrying: true } : { phase: "checking" }));
    fetchSetupState()
      .then((s) => {
        if (cancelled) return;
        log.info("gateway is up", {
          ms: Math.round(performance.now() - started),
          needsSetup: s.needsSetup,
        });
        setProbe({ needsSetup: s.needsSetup, phase: "ready" });
      })
      .catch(() => {
        if (cancelled) return;
        log.warn("gateway is not answering", { attempt });
        setProbe({ phase: "offline", retrying: false, triedAt: new Date() });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  useEffect(() => {
    if (probe.phase !== "offline" || probe.retrying) return;
    const t = setTimeout(() => setAttempt((n) => n + 1), AUTO_RETRY_SECONDS * 1000);
    return () => clearTimeout(t);
  }, [probe]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { probe, retry };
};
