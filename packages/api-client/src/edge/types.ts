/**
 * The network edge an app build talks to. A build gets exactly one, chosen by the Vite
 * mode when it is built: the live gateway, or the mock gateway for local work. App code
 * imports it as `@sneakers-web/edge` and never checks which one it got.
 */
export interface Edge {
  /** Text for the persistent banner every shell shows, or null for none. */
  banner: null | string;
  mode: "live" | "mock";
  /** Called once before the app renders. */
  start(): Promise<void>;
  /** Prefix for every browser storage key, so the two modes never share state. */
  storagePrefix: string;
}
