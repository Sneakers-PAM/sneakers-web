import {
  auth,
  createLogger,
  gql,
  MeDocument,
  setSessionEvents,
  type UserFieldsFragment,
} from "@sneakers-web/api-client";
import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const log = createLogger("session");

export interface AuthState {
  /**
   * Re-read the session after the sign-in flow finished and load the user. `beforeOpen`
   * runs with the loaded user before the app opens (the welcome step uses it).
   */
  completeSignIn: (beforeOpen?: (user: SessionUser) => Promise<void>) => Promise<void>;
  /** Why the last session ended on its own, for the sign-in screen to say. */
  endedReason: "expired" | null;
  isAdmin: boolean;
  /** The user enrolled a factor from inside the app; drop the nudge. */
  markEnrolled: () => void;
  /** The user has a confirmed factor. */
  mfaEnrolled: boolean;
  /** MFA is optional and the user has no factor: show the setup nudge. */
  mfaSetupRecommended: boolean;
  signOut: () => Promise<void>;
  status: AuthStatus;
  user: null | SessionUser;
}

export type AuthStatus = "enroll" | "loading" | "signed-in" | "signed-out";

export type SessionUser = UserFieldsFragment;

const Ctx = createContext<AuthState | null>(null);

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

/**
 * Holds who is signed in. The gateway's session cookie is the source of truth: on load
 * the session is read from /auth/session, and any request that comes back 401 (or 403
 * mfa_required) moves the app back to sign-in (or to the enrolment wall).
 */
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const qc = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<null | SessionUser>(null);
  const [mfaSetupRecommended, setSetupRecommended] = useState(false);
  const [mfaEnrolled, setEnrolled] = useState(false);
  const [endedReason, setEndedReason] = useState<"expired" | null>(null);
  const started = useRef(false);

  const resolve = useCallback(async (beforeOpen?: (user: SessionUser) => Promise<void>) => {
    const s = await auth.getSession();
    if (!s.authenticated || !s.userId) {
      setUser(null);
      setStatus("signed-out");
      log.debug("no session");
      return;
    }
    setEnrolled(s.enrolled);
    if (s.enrollmentRequired) {
      setSetupRecommended(false);
      setStatus("enroll");
      log.info("session needs a second factor before the app opens");
      return;
    }
    setSetupRecommended(s.setupRecommended);
    const loaded = await loadUser(s.userId);
    await beforeOpen?.(loaded);
    setUser(loaded);
    setEndedReason(null);
    setStatus("signed-in");
    log.info("signed in", { user: s.userId });
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    resolve().catch(() => {
      log.warn("session check failed; showing sign-in");
      setStatus("signed-out");
    });
  }, [resolve]);

  useEffect(() => {
    setSessionEvents({
      onMfaRequired: () => setStatus("enroll"),
      onUnauthenticated: () => {
        log.info("the gateway ended the session");
        qc.clear();
        setUser(null);
        setEndedReason("expired");
        setStatus((s) => (s === "signed-in" ? "signed-out" : s));
      },
    });
    return () => setSessionEvents({});
  }, [qc]);

  const signOut = useCallback(async () => {
    try {
      await auth.logout();
    } catch {
      log.warn("logout call failed; clearing the local session anyway");
    }
    qc.clear();
    setUser(null);
    setEndedReason(null);
    setStatus("signed-out");
  }, [qc]);

  const markEnrolled = useCallback(() => {
    setSetupRecommended(false);
    setEnrolled(true);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      completeSignIn: resolve,
      endedReason,
      isAdmin: !!user && (user.isRoot || user.roles.includes("site-admin")),
      markEnrolled,
      mfaEnrolled,
      mfaSetupRecommended,
      signOut,
      status,
      user,
    }),
    [status, user, mfaSetupRecommended, mfaEnrolled, endedReason, resolve, signOut, markEnrolled],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useAuth = (): AuthState => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth needs an AuthProvider above it");
  return v;
};

/** The signed-in user. Only call it below the gate, where a user always exists. */
export const useUser = (): SessionUser => {
  const { user } = useAuth();
  if (!user) throw new Error("useUser called outside a signed-in shell");
  return user;
};

/** Load the profile for the session's user. A failed lookup must not block a valid session. */
const loadUser = async (id: string): Promise<SessionUser> => {
  try {
    const d = await gql(MeDocument, { id });
    return d.user ?? idOnlyUser(id);
  } catch {
    log.warn("profile lookup failed; continuing with the id only");
    return idOnlyUser(id);
  }
};
