import { auth, createLogger, type TotpEnrollment } from "@sneakers-web/api-client";
import { type ActionFunctionArgs, data, type LoaderFunctionArgs, redirect } from "react-router";

import { gatewayFor, relayCookies } from "#shell/server/gateway.server";
import { appPath, safeNext } from "#shell/server/paths.server";
import { sessionFor, unreachable } from "#shell/server/session.server";

const log = createLogger("mfa-enrol");

export interface EnrollLoaderData {
  /** MFA is enforced: no "Skip for now", only Sign out. */
  enforced: boolean;
  enrollment: null | TotpEnrollment;
  next: string;
}

export type EnrollState =
  | { passkeyOptions: string; passkeySession: string; view: "passkey" }
  | { problem?: "passkey" | "start"; view: "form"; wrong?: boolean };

/** The enrolment page: needs a session (full, or the half one MFA enforcement leaves). */
export const enrollLoader = async ({ request }: LoaderFunctionArgs): Promise<EnrollLoaderData> => {
  const next = safeNext(new URL(request.url).searchParams.get("next"));
  const gw = gatewayFor(request);
  const s = await sessionFor(request).catch(() => {
    throw unreachable();
  });
  if (!s.authenticated) throw redirect(appPath("sign-in"));
  let enrollment: null | TotpEnrollment = null;
  try {
    enrollment = await auth.beginTotpEnrollment(gw);
  } catch {
    log.warn("could not start authenticator enrolment");
  }
  return { enforced: s.enrollmentRequired, enrollment, next };
};

export const enrollAction = async ({ request }: ActionFunctionArgs) => {
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  const next = safeNext(form.get("next"));
  const gw = gatewayFor(request);
  await sessionFor(request);
  try {
    if (intent === "confirm") {
      const code = String(form.get("code") ?? "").replaceAll(/\D/g, "");
      if (code.length === 6 && (await auth.confirmTotpEnrollment(gw, code))) {
        throw redirect(next, { headers: relayCookies(gw) });
      }
      return data<EnrollState>({ view: "form", wrong: true });
    }
    if (intent === "passkey-cancelled")
      return data<EnrollState>({ problem: "passkey", view: "form" });
    if (intent === "passkey-begin") {
      const { optionsJson, sessionId } = await auth.beginPasskeyEnrollment(gw);
      return data<EnrollState>({
        passkeyOptions: optionsJson,
        passkeySession: sessionId,
        view: "passkey",
      });
    }
    if (intent === "passkey-finish") {
      await auth.finishPasskeyEnrollment(
        gw,
        String(form.get("passkeySession") ?? ""),
        String(form.get("credential") ?? ""),
        "Passkey",
      );
      throw redirect(next, { headers: relayCookies(gw) });
    }
  } catch (error) {
    if (error instanceof Response) throw error;
    return data<EnrollState>({
      problem: intent.startsWith("passkey") ? "passkey" : "start",
      view: "form",
    });
  }
  return data<EnrollState>({ view: "form" }, { status: 400 });
};
