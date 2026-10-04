export interface Edge {
  /** Text for the persistent banner every screen shows, or null for none. */
  banner: null | string;
  /** Prefix for this app's own cookies, so the two modes never share one. */
  cookiePrefix: string;
  /** Where the gateway answers, seen from the app server. */
  gatewayUrl: string;
  mode: "live" | "mock";
  /**
   * Mock builds only: sign in as a fixture user without a password. `signIn` answers the
   * session cookie to set and whether the user must enrol first, or null for no such user.
   * The live edge never has it.
   */
  quickLogin?: {
    signIn(userId: string): { cookie: string; enroll: boolean } | null;
    users(): QuickLoginUser[];
  };
  /** The gateway's session cookie this edge forwards. */
  sessionCookie: string;
  /** The absolute URL that starts single sign-on, for an app at `origin` served under `base`. */
  ssoStart(origin: string, base: string): string;
  /** Called once when the server starts. */
  start(): Promise<void>;
  /** Prefix for browser storage keys, so the two modes never share state. */
  storagePrefix: string;
}

/**
 * The network edge an app build talks to. A build gets exactly one, chosen by the Vite
 * mode when it is built: the live gateway, or the mock gateway for local work. Server code
 * imports it as `@sneakers-web/edge.server`; the browser never loads it, and app code never
 * checks which one it got.
 */
/** A fixture user the dev quick login offers, with a few words on what they're for. */
export interface QuickLoginUser {
  id: string;
  label: string;
  note: string;
}
