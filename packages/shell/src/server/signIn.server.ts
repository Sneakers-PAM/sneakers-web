import {
  ApiError,
  auth,
  createLogger,
  type GatewayClient,
  GatewayUnreachableError,
  MeDocument,
  publicConfigFrom,
  type SecondFactor,
} from "@sneakers-web/api-client";
import { edge } from "@sneakers-web/edge.server";
import { type ActionFunctionArgs, data, type LoaderFunctionArgs, redirect } from "react-router";

import { gatewayFor, relayCookies } from "#shell/server/gateway.server";
import { appBase, appPath, safeNext } from "#shell/server/paths.server";
import { sessionFor } from "#shell/server/session.server";

const log = createLogger("sign-in");

export type CodeFactor = "email" | "totp";

export interface SignInLoaderData {
  ended: boolean;
  next: string;
  sso: boolean;
  state: SignInState;
}

/** Every state the sign-in screen can be in. The server decides; the page renders it. */
export type SignInState =
  | {
      emailState?: "sent" | "wait";
      factor: CodeFactor;
      factors: SecondFactor[];
      identifier: string;
      passkeyOptions?: string;
      pendingId: string;
      problem?: "expired" | "passkey" | "send";
      view: "code";
      wrong?: boolean;
    }
  | { failed?: boolean; view: "sso" }
  | {
      identifier?: string;
      notice?: "reset";
      problem?: "disabled" | "invalid" | "missing" | "offline";
      view: "local";
    }
  | { name: string; next: string; view: "done" };

const ssoEnabled = () => publicConfigFrom(process.env, "").sso;

/** Where the screen starts: an SSO hand-back, the local form, or the SSO button. */
export const signInLoader = async ({ request }: LoaderFunctionArgs): Promise<SignInLoaderData> => {
  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get("next"));
  try {
    const s = await sessionFor(request);
    if (s.authenticated && s.enrollmentRequired) throw redirect(appPath("enroll"));
    if (s.authenticated) throw redirect(next);
  } catch (error) {
    if (error instanceof Response) throw error;
    if (!(error instanceof ApiError || error instanceof GatewayUnreachableError)) throw error;
  }
  const back = auth.readSsoReturn(url.search);
  let state: SignInState =
    ssoEnabled() || url.searchParams.get("view") === "sso" ? { view: "sso" } : { view: "local" };
  if (url.searchParams.get("view") === "local") state = { view: "local" };
  if (url.searchParams.get("notice") === "reset") state = { notice: "reset", view: "local" };
  if (back?.kind === "failed") {
    log.warn("single sign-on came back with an error", { reason: back.reason });
    state = { failed: true, view: "sso" };
  }
  if (back?.kind === "challenge") {
    const codeFactors = back.factors.filter((f) => f !== "passkey");
    state = {
      factor: codeFactors.includes("totp") || codeFactors.length === 0 ? "totp" : "email",
      factors: back.factors,
      identifier: "",
      pendingId: back.pendingId,
      view: "code",
    };
  }
  return { ended: url.searchParams.get("ended") === "1", next, sso: ssoEnabled(), state };
};

const opened = async (gw: GatewayClient, next: string) => {
  const s = await auth.getSession(gw);
  if (s.enrollmentRequired) throw redirect(appPath("enroll"), { headers: relayCookies(gw) });
  const me = s.userId ? await gw.gql(MeDocument, { id: s.userId }).catch(() => null) : null;
  const name = me?.user?.name ?? "";
  return data<SignInState>({ name, next, view: "done" }, { headers: relayCookies(gw) });
};

const field = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

/** One step of signing in: start SSO, the password, a code, an emailed code or a passkey. */
export const signInAction = async ({ request }: ActionFunctionArgs) => {
  const form = await request.formData();
  const intent = field(form, "intent");
  const next = safeNext(form.get("next"));
  const gw = gatewayFor(request);

  if (intent === "sso") {
    log.info("starting single sign-on");
    // An absolute URL: single sign-on may leave the app, and React Router leaves those as they are.
    throw redirect(edge.ssoStart(new URL(request.url).origin, appBase()));
  }

  if (intent === "login") {
    const identifier = field(form, "identifier");
    const password = String(form.get("password") ?? "");
    if (!identifier || !password)
      return data<SignInState>({ identifier, problem: "missing", view: "local" });
    try {
      const r = await auth.login(gw, identifier, password);
      if (r.kind === "rejected")
        return data<SignInState>({ identifier, problem: r.reason, view: "local" });
      if (r.kind === "challenge") {
        return data<SignInState>({
          factor: r.factors.includes("totp") || !r.factors.includes("email") ? "totp" : "email",
          factors: r.factors,
          identifier,
          pendingId: r.pendingId,
          view: "code",
        });
      }
      return await opened(gw, next);
    } catch (error) {
      if (error instanceof Response) throw error;
      log.warn("password step failed", { error: error instanceof Error ? error.name : "unknown" });
      return data<SignInState>({ identifier, problem: "offline", view: "local" });
    }
  }

  const pendingId = field(form, "pendingId");
  const identifier = field(form, "identifier");
  const factors = field(form, "factors")
    .split(",")
    .filter((f): f is SecondFactor => ["email", "passkey", "totp"].includes(f));
  const factor: CodeFactor = field(form, "factor") === "email" ? "email" : "totp";
  const base = { factor, factors, identifier, pendingId, view: "code" as const };

  try {
    if (intent === "email") {
      return data<SignInState>({
        ...base,
        emailState: await auth.sendLoginEmailCode(gw, pendingId),
        factor: "email",
      });
    }
    if (intent === "verify") {
      const code = field(form, "code").replaceAll(/\D/g, "");
      if (code.length !== 6) return data<SignInState>({ ...base, wrong: true });
      if (await auth.verifySecondFactor(gw, pendingId, factor, code)) return await opened(gw, next);
      return data<SignInState>({ ...base, wrong: true });
    }
    if (intent === "passkey-cancelled") return data<SignInState>({ ...base, problem: "passkey" });
    if (intent === "passkey-begin") {
      return data<SignInState>({
        ...base,
        passkeyOptions: await auth.beginPasskeyLogin(gw, pendingId),
      });
    }
    if (intent === "passkey-verify") {
      if (
        await auth.verifySecondFactor(
          gw,
          pendingId,
          "passkey",
          String(form.get("credential") ?? ""),
        )
      ) {
        return await opened(gw, next);
      }
      return data<SignInState>({ ...base, problem: "passkey" });
    }
  } catch (error) {
    if (error instanceof Response) throw error;
    if (error instanceof ApiError && error.code === "invalid_pending") {
      return data<SignInState>({ ...base, problem: "expired" });
    }
    log.warn("second-factor step failed", { intent });
    return data<SignInState>({
      ...base,
      problem: intent === "email" ? "send" : intent.startsWith("passkey") ? "passkey" : "expired",
    });
  }
  return data<SignInState>({ view: "local" }, { status: 400 });
};

export type ResetState =
  | {
      email: string;
      problem?: "invalid_code" | "mismatch" | "short" | "unavailable" | "weak_password";
      step: "confirm";
    }
  | { email: string; problem?: "missing" | "send"; step: "request" };

export const RESET_MIN_LENGTH = 8;

/** Self-service password reset: ask for a code, then set a new password with it. */
export const resetAction = async ({ request }: ActionFunctionArgs) => {
  const form = await request.formData();
  const gw = gatewayFor(request);
  const email = field(form, "email");
  if (field(form, "intent") === "request") {
    if (!email) return data<ResetState>({ email, problem: "missing", step: "request" });
    try {
      await auth.requestPasswordReset(gw, email);
      log.info("reset code requested");
      return data<ResetState>({ email, step: "confirm" });
    } catch {
      return data<ResetState>({ email, problem: "send", step: "request" });
    }
  }
  const code = field(form, "code").replaceAll(/\D/g, "");
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  if (password.length < RESET_MIN_LENGTH)
    return data<ResetState>({ email, problem: "short", step: "confirm" });
  if (password !== confirm)
    return data<ResetState>({ email, problem: "mismatch", step: "confirm" });
  const r = await auth.confirmPasswordReset(gw, email, code, password).catch(() => ({
    ok: false as const,
    reason: "unavailable" as const,
  }));
  if (r.ok) throw redirect(`${appPath("sign-in")}?notice=reset`);
  return data<ResetState>({ email, problem: r.reason, step: "confirm" });
};

/** End the session at the gateway, then back to sign-in. */
export const signOutAction = async ({ request }: ActionFunctionArgs) => {
  const gw = gatewayFor(request);
  try {
    await auth.logout(gw);
  } catch {
    log.warn("logout call failed; sending the browser to sign-in anyway");
  }
  const headers = relayCookies(gw);
  if (gw.setCookies.length === 0) {
    headers.append(
      "Set-Cookie",
      `${edge.sessionCookie}=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict`,
    );
  }
  return redirect(appPath("sign-in"), { headers });
};
