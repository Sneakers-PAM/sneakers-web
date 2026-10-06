import { ApiError, createLogger, type GatewayClient } from "@sneakers-web/api-client";
import { guard, requireUser } from "@sneakers-web/shell/server";

const log = createLogger("agent-consent");

/** G-10: what the consent page shows for `?req=`. */
export type ConsentData =
  | {
      clientName: string;
      factorRequired: boolean;
      redirectHost: string;
      req: string;
      user: Person;
      view: "form";
    }
  | { user: Person; view: "expired" | "no-request" };

/** What a consent post answers: where to send the browser, or what went wrong. */
export type ConsentResult =
  | { emailSent: true }
  | { label: string; redirect: string; view: "done" }
  | { passkey: { options: string; webauthnSessionId: string } }
  | { problem: "code" | "email" | "expired" | "passkey" | "step-up" | "unavailable" }
  | { redirect: string; view: "denied" };

interface Person {
  email: string;
  name: string;
}

const field = (form: FormData, key: string): string => String(form.get(key) ?? "").trim();

const requestId = (request: Request) => new URL(request.url).searchParams.get("req")?.trim() ?? "";

const consentPath = (request: string, step = "") =>
  `/oauth2/consent/${encodeURIComponent(request)}${step}`;

const expired = (error: unknown) =>
  error instanceof ApiError && (error.status === 404 || error.code === "request_expired");

/**
 * The consent page's data: the app asking for a token and where it returns to. Signing in
 * first is required; sign-in brings the person back here with the same `req`.
 */
export const loadConsent = async (request: Request): Promise<ConsentData> => {
  const { gw, user } = await requireUser(request);
  const person = { email: user.email, name: user.name };
  const request_ = requestId(request);
  if (!request_) {
    log.info("consent opened without a request");
    return { user: person, view: "no-request" };
  }
  return guard(request, async () => {
    try {
      const d = await gw.request<{
        clientName?: string;
        factorRequired?: boolean;
        redirectHost?: string;
      }>(consentPath(request_), {
        csrf: true,
      });
      // A gateway that doesn't say asks for the factor, as it always did.
      const factorRequired = d.factorRequired !== false;
      log.debug("consent request loaded", { factorRequired });
      return {
        clientName: d.clientName || "An app",
        factorRequired,
        redirectHost: d.redirectHost ?? "",
        req: request_,
        user: person,
        view: "form" as const,
      };
    } catch (error) {
      if (expired(error)) {
        log.info("consent request expired");
        return { user: person, view: "expired" as const };
      }
      throw error;
    }
  });
};

const decide = async (
  gw: GatewayClient,
  request: string,
  form: FormData,
): Promise<ConsentResult> => {
  const approve = field(form, "intent") === "allow";
  const kind = field(form, "factor");
  const label = field(form, "label");
  const given =
    kind === "passkey"
      ? {
          credentialJson: String(form.get("credentialJson") ?? ""),
          kind,
          webauthnSessionId: field(form, "webauthnSessionId"),
        }
      : {
          code: field(form, "code").replaceAll(/\D/g, ""),
          kind: kind === "email" ? "email" : "totp",
        };
  // No factor means the session's own, within the step-up window, covers the consent.
  const factor = kind ? given : {};
  try {
    const { redirect } = await gw.request<{ redirect: string }>(consentPath(request), {
      body: { approve, factor: approve ? factor : {}, label },
      csrf: true,
    });
    log.info(approve ? "consent allowed" : "consent denied", {
      factor: approve ? kind || "session" : undefined,
    });
    return approve ? { label, redirect, view: "done" } : { redirect, view: "denied" };
  } catch (error) {
    // A wrong code is 401 too; it isn't the session ending, so it stays on the page.
    if (error instanceof ApiError && error.code === "invalid_code") {
      log.info("consent factor didn't match", { factor: kind });
      return { problem: kind === "passkey" ? "passkey" : "code" };
    }
    if (error instanceof ApiError && error.code === "step_up_required") {
      log.info("consent needs a step-up: the sign-in factor is too old");
      return { problem: "step-up" };
    }
    if (expired(error)) return { problem: "expired" };
    if (error instanceof ApiError && error.status >= 500) {
      log.warn("consent failed", { code: error.code, status: error.status });
      return { problem: "unavailable" };
    }
    throw error;
  }
};

/** `allow` (with the factor and the token's name), `deny`, `email` and `passkey-begin`. */
export const consentAction = async (request: Request): Promise<ConsentResult> => {
  const { gw } = await requireUser(request);
  const form = await request.formData();
  const intent = field(form, "intent");
  const request_ = requestId(request);
  log.debug("consent step", { intent });
  if (!request_) return { problem: "expired" };
  return guard(request, async () => {
    if (intent === "allow" || intent === "deny") return decide(gw, request_, form);
    if (intent === "email") {
      try {
        await gw.request(consentPath(request_, "/email-code"), { body: {}, csrf: true });
        return { emailSent: true as const };
      } catch (error) {
        if (expired(error)) return { problem: "expired" as const };
        if (error instanceof ApiError && error.status !== 401) return { problem: "email" as const };
        throw error;
      }
    }
    if (intent === "passkey-begin") {
      try {
        const r = await gw.request<{ options?: string; webauthnSessionId?: string }>(
          consentPath(request_, "/passkey/begin"),
          { body: {}, csrf: true },
        );
        return {
          passkey: { options: r.options ?? "", webauthnSessionId: r.webauthnSessionId ?? "" },
        };
      } catch (error) {
        if (expired(error)) return { problem: "expired" as const };
        if (error instanceof ApiError && error.status !== 401)
          return { problem: "passkey" as const };
        throw error;
      }
    }
    log.warn("unknown intent", { intent });
    throw new Response("Unknown intent", { status: 400 });
  });
};
