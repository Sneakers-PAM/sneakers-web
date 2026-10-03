import {
  ApiError,
  auth,
  createLogger,
  type GatewayClient,
  type SecondFactor,
  type TotpEnrollment,
} from "@sneakers-web/api-client";
import { type Refusal } from "@sneakers-web/shell";
import { appPath, guard, relayCookies, requireUser } from "@sneakers-web/shell/server";
import { redirect } from "react-router";

const log = createLogger("security");

/** One of the user's own second factors. Times are null when the gateway didn't say. */
export interface FactorView {
  createdAt: null | string;
  id: string;
  kind: SecondFactor;
  label: string;
  lastUsedAt: null | string;
}

export interface SecurityData {
  email: string;
  factors: FactorView[];
  /** False when the gateway has no factor list yet and the rows come from the session. */
  listed: boolean;
  /** `?setup=authenticator`: open the authenticator setup straight away. */
  setup: boolean;
}

export type SecurityResult =
  | {
      done?: string;
      enrollment?: TotpEnrollment;
      intent: string;
      ok: true;
      passkey?: { optionsJson: string; sessionId: string };
    }
  | { intent: string; ok: false; refusal: Refusal }
  | { intent: string; ok: false; wrong: true };

const LABELS: Record<SecondFactor, string> = {
  email: "Email codes",
  passkey: "Passkey",
  totp: "Authenticator app",
};

interface FactorWire {
  createdAt?: null | string;
  id?: string;
  kind?: string;
  label?: string;
  lastUsedAt?: null | string;
}

const KINDS = new Set<string>(["email", "passkey", "totp"]);

const fromWire = (f: FactorWire): FactorView | null =>
  f.kind && KINDS.has(f.kind)
    ? {
        createdAt: f.createdAt ?? null,
        id: f.id ?? f.kind,
        kind: f.kind as SecondFactor,
        label: f.label || LABELS[f.kind as SecondFactor],
        lastUsedAt: f.lastUsedAt ?? null,
      }
    : null;

const inferred = (kind: SecondFactor): FactorView => ({
  createdAt: null,
  id: kind,
  kind,
  label: LABELS[kind],
  lastUsedAt: null,
});

/**
 * The user's factors from GET /auth/mfa/factors. A gateway without that route (404 or 405)
 * gets the old posture instead: a confirmed factor reads as the authenticator app, and a
 * verified address as email codes.
 */
const readFactors = async (
  gw: GatewayClient,
  posture: { emailVerified: boolean; enrolled: boolean },
): Promise<{ factors: FactorView[]; listed: boolean }> => {
  try {
    const r = await gw.request<{ factors?: FactorWire[] }>("/auth/mfa/factors", { csrf: true });
    const factors = (r.factors ?? [])
      .map((f) => fromWire(f))
      .filter((f): f is FactorView => f !== null);
    log.debug("factors listed", { count: factors.length });
    return { factors, listed: true };
  } catch (error) {
    if (!(error instanceof ApiError) || (error.status !== 404 && error.status !== 405)) throw error;
    log.info("gateway has no factor list; using the session posture");
    const factors: FactorView[] = [];
    if (posture.enrolled) factors.push(inferred("totp"));
    if (posture.emailVerified) factors.push(inferred("email"));
    return { factors, listed: false };
  }
};

export const loadSecurity = async (request: Request): Promise<SecurityData> => {
  const { gw, session, user } = await requireUser(request);
  log.debug("security page load");
  const { factors, listed } = await guard(request, () =>
    readFactors(gw, { emailVerified: user.emailVerified, enrolled: session.enrolled }),
  );
  const setup = new URL(request.url).searchParams.get("setup") === "authenticator";
  log.debug("security page loaded", { factors: factors.length, listed, setup });
  return { email: user.email, factors, listed, setup };
};

/** The gateway's /auth error codes, as the refusals the page explains. */
const REFUSALS: Record<string, Omit<Refusal, "metadata">> = {
  already_enrolled: {
    code: "ALREADY_EXISTS",
    detail: "you already have an authenticator app; remove it first to switch apps",
  },
  last_factor: { code: "FAILED_PRECONDITION", detail: "last factor", reason: "MFA_LAST_FACTOR" },
  mfa_unavailable: { code: "UNAVAILABLE", detail: "second factors are unavailable" },
  no_passkey: {
    code: "FAILED_PRECONDITION",
    detail: "passkeys aren't available on this server right now",
  },
  step_up_required: {
    code: "FAILED_PRECONDITION",
    detail: "a fresh second factor is required",
    reason: "STEP_UP_REQUIRED",
  },
};

const refusalFrom = (error: ApiError): Refusal => ({
  metadata: {},
  ...(REFUSALS[error.code ?? ""] ?? { code: "UNAVAILABLE", detail: error.code ?? "" }),
});

const field = (form: FormData, key: string): string => String(form.get(key) ?? "").trim();

const work = async (gw: GatewayClient, intent: string, form: FormData): Promise<SecurityResult> => {
  switch (intent) {
    case "passkey-begin": {
      return { intent, ok: true, passkey: await auth.beginPasskeyEnrollment(gw) };
    }
    case "passkey-finish": {
      await auth.finishPasskeyEnrollment(
        gw,
        field(form, "passkeySession"),
        String(form.get("credential") ?? ""),
        LABELS.passkey,
      );
      return { done: "Passkey added.", intent, ok: true };
    }
    case "remove-totp": {
      await gw.request("/auth/mfa/remove", { body: {}, csrf: true });
      log.info("authenticator removed; the session ended");
      throw redirect(`${appPath("sign-in")}?ended=1&next=${encodeURIComponent("/security")}`, {
        headers: relayCookies(gw),
      });
    }
    case "totp-begin": {
      return { enrollment: await auth.beginTotpEnrollment(gw), intent, ok: true };
    }
    case "totp-confirm": {
      const code = field(form, "code").replaceAll(/\D/g, "");
      if (code.length !== 6 || !(await auth.confirmTotpEnrollment(gw, code)))
        return { intent, ok: false, wrong: true };
      return { done: "Authenticator app added.", intent, ok: true };
    }
  }
  log.warn("unknown security intent", { intent });
  return {
    intent,
    ok: false,
    refusal: { code: "INVALID_ARGUMENT", detail: "that action isn't known", metadata: {} },
  };
};

/**
 * One change to the user's own sign-in methods. A refusal comes back as data for the page:
 * STEP_UP_REQUIRED opens the step-up prompt and the page retries. Removing the authenticator
 * ends the session, so it answers with a redirect to sign in.
 */
export const securityAction = async (request: Request): Promise<SecurityResult> => {
  const { gw } = await requireUser(request);
  const form = await request.formData();
  const intent = field(form, "intent");
  log.debug("security action", { intent });
  return guard(request, async () => {
    try {
      const result = await work(gw, intent, form);
      log.info("security action done", { intent, ok: result.ok });
      return result;
    } catch (error) {
      if (error instanceof Response) throw error;
      if (!(error instanceof ApiError) || error.status === 401) throw error;
      const refusal = refusalFrom(error);
      log.info("security action refused", { code: error.code, intent, reason: refusal.reason });
      return { intent, ok: false as const, refusal };
    }
  });
};
