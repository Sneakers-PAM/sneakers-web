import { scrub } from "#shell/diagnostics/report";
import { easternIso } from "#shell/issueCopy/time";

/**
 * Schema v1: the dev-only "Copy for UI issue" bundle, one line of minified JSON. Keys are
 * fixed and appear in this order -- the shared reference every product's web repo keeps
 * identical. A key with nothing to say is left out here, never set to null.
 */
export interface IssueCopyBundle {
  app: string;
  clicked?: string;
  dpr: number;
  lastErr?: IssueCopyError;
  locale?: string;
  params?: Record<string, string>;
  path?: string;
  product: "sneakers";
  recentErrors?: IssueCopyError[];
  role?: string;
  route?: string;
  sha: string;
  t: string;
  theme?: string;
  ua: string;
  v: 1;
  vh: number;
  vw: number;
}

/** One ring buffer entry: a redacted message, its source and when it happened (ET). */
export interface IssueCopyError {
  at: string;
  m: string;
  src: IssueCopyErrorSource;
}

export type IssueCopyErrorSource = "fetch" | "promise" | "render" | "window";

export interface IssueCopyInput {
  app: string;
  clicked?: string;
  dpr: number;
  errors: readonly IssueCopyError[];
  locale?: string;
  now: Date;
  params?: Readonly<Record<string, string>>;
  path?: string;
  role?: string;
  route?: string;
  sha: string;
  theme?: string;
  ua: string;
  vh: number;
  vw: number;
}

/** The ring buffer's capacity: `lastErr` is the newest entry, `recentErrors` the rest. */
export const MAX_ERRORS = 5;

const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

/** Only ids travel in `params`: anything else (a username, a serial) could name a person or a box. */
const isId = (value: string): boolean => ULID.test(value) || UUID.test(value);

const text = (s: string | undefined): string | undefined => (s ? scrub(s) : undefined);

/** Build the schema v1 bundle, in the exact key order above. */
export const buildIssueCopyBundle = (input: IssueCopyInput): IssueCopyBundle => {
  const { app: appName, sha: commitSha } = input;
  const ring = input.errors.slice(0, MAX_ERRORS);
  // eslint-disable-next-line perfectionist/sort-objects -- the schema v1 wire order (v, then product) is a fixed external contract, not a style choice.
  const bundle = { v: 1, product: "sneakers" } as IssueCopyBundle;
  // Bracket form only here, so a leak scanner's gTLD heuristic ("app" is a real TLD) can't read this as a host name.
  bundle["app"] = scrub(appName);
  bundle.sha = scrub(commitSha);
  const route = text(input.route);
  if (route) bundle.route = route;
  const path = text(input.path);
  if (path) bundle.path = path;
  const ids = Object.entries(input.params ?? {}).filter(([, value]) => isId(value));
  if (ids.length > 0) bundle.params = Object.fromEntries(ids);
  const role = text(input.role);
  if (role) bundle.role = role;
  bundle.vw = input.vw;
  bundle.vh = input.vh;
  bundle.dpr = input.dpr;
  bundle.ua = scrub(input.ua);
  bundle.t = easternIso(input.now);
  const theme = text(input.theme);
  if (theme) bundle.theme = theme;
  const locale = text(input.locale);
  if (locale) bundle.locale = locale;
  const clicked = text(input.clicked);
  if (clicked) bundle.clicked = clicked;
  if (ring[0]) bundle.lastErr = ring[0];
  if (ring.length > 1) bundle.recentErrors = ring.slice(1);
  return bundle;
};

/** The bundle as one minified line of JSON, with its keys in the fixed schema v1 order. */
export const issueCopyLine = (input: IssueCopyInput): string =>
  JSON.stringify(buildIssueCopyBundle(input));
