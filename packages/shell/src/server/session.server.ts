import {
  ApiError,
  auth,
  createLogger,
  fetchSetupState,
  type GatewayClient,
  GatewayUnreachableError,
  MeDocument,
  type SessionInfo,
  type UserFieldsFragment,
} from "@sneakers-web/api-client";
import { redirect } from "react-router";

import { gatewayFor, relayCookies } from "#shell/server/gateway.server";
import { appPath, pathInApp } from "#shell/server/paths.server";

const log = createLogger("session");

export type SessionUser = UserFieldsFragment;

export interface SignedIn {
  gw: GatewayClient;
  session: SessionInfo;
  user: SessionUser;
}

const sessions = new WeakMap<Request, Promise<SessionInfo>>();
let setupDone = false;

/** The gateway is down: every page shows the "can't reach the server" screen instead. */
export const unreachable = (): Response =>
  Response.json(
    { kind: "gateway-unreachable" },
    { status: 503, statusText: "Gateway unreachable" },
  );

/** Read the session once per request (the root, the layout and the page all ask). */
export const sessionFor = (request: Request): Promise<SessionInfo> => {
  let p = sessions.get(request);
  if (!p) {
    p = auth.getSession(gatewayFor(request));
    sessions.set(request, p);
  }
  return p;
};

/** Whether the install still has no administrator. Once it has one, that never changes. */
export const needsSetup = async (request: Request): Promise<boolean> => {
  if (setupDone) return false;
  try {
    const { needsSetup: needs } = await fetchSetupState(gatewayFor(request));
    if (!needs) setupDone = true;
    return needs;
  } catch (error) {
    if (
      error instanceof GatewayUnreachableError ||
      (error instanceof ApiError && error.status >= 500)
    ) {
      throw unreachable();
    }
    throw error;
  }
};

const idOnlyUser = (id: string): SessionUser => ({
  disabled: false,
  email: "",
  emailVerified: false,
  id,
  isRoot: false,
  name: id,
  roles: [],
  username: id,
});

/** Resource routes carry no page of their own: a background fetch to one (the notifications
 * badge polling, diagnostics, display, step-up) that happens to find the session dead must
 * never become where sign-in sends the admin back to. */
const isResourceRoute = (path: string): boolean => path.startsWith("/resources/");

/**
 * Where sign-in should return to: the request's own path, unless it's a resource route's
 * background fetch, in which case its Referer names the real page that made the fetch (with
 * no usable Referer, or one outside the app, the app's start).
 */
const nextAfterSignIn = (request: Request): string => {
  const path = pathInApp(new URL(request.url));
  if (!isResourceRoute(path)) return path;
  const referer = request.headers.get("Referer");
  if (!referer) return appPath("");
  try {
    return isResourceRoute(pathInApp(new URL(referer))) ? appPath("") : pathInApp(new URL(referer));
  } catch {
    return appPath("");
  }
};

const signInRedirect = (request: Request, gw: GatewayClient, ended: boolean) => {
  const q = new URLSearchParams({ next: nextAfterSignIn(request) });
  if (ended) q.set("ended", "1");
  return redirect(`${appPath("sign-in")}?${q.toString()}`, { headers: relayCookies(gw) });
};

/**
 * The signed-in user for a page, or a redirect: to sign-in when there's no session, to
 * the enrolment wall when MFA is enforced and no factor is verified yet.
 */
export const requireUser = async (request: Request): Promise<SignedIn> => {
  const gw = gatewayFor(request);
  let session: SessionInfo;
  try {
    session = await sessionFor(request);
  } catch (error) {
    if (
      error instanceof GatewayUnreachableError ||
      (error instanceof ApiError && error.status >= 500)
    ) {
      throw unreachable();
    }
    throw error;
  }
  if (!session.authenticated || !session.userId)
    throw signInRedirect(request, gw, gw.hasSessionCookie);
  if (session.enrollmentRequired) throw redirect(appPath("enroll"), { headers: relayCookies(gw) });
  let user: SessionUser;
  try {
    const me = await gw.gql(MeDocument, { id: session.userId });
    user = me.user ?? idOnlyUser(session.userId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) throw signInRedirect(request, gw, true);
    log.warn("profile lookup failed; continuing with the id only");
    user = idOnlyUser(session.userId);
  }
  return { gw, session, user };
};

/**
 * Turn a gateway refusal of the session into the right answer for a loader: back to
 * sign-in on 401, to enrolment on 403 mfa_required. Anything else is rethrown.
 */
export const guard = async <T>(request: Request, work: () => Promise<T>): Promise<T> => {
  try {
    return await work();
  } catch (error) {
    const gw = gatewayFor(request);
    if (error instanceof ApiError && error.status === 401) throw signInRedirect(request, gw, true);
    if (error instanceof ApiError && error.code === "mfa_required")
      throw redirect(appPath("enroll"));
    if (error instanceof GatewayUnreachableError) throw unreachable();
    throw error;
  }
};

export const isAdmin = (user: SessionUser): boolean =>
  user.isRoot || user.roles.includes("site-admin");
