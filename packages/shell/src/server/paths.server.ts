/** The path an app is served under ("/" or "/admin/"), from the build's base URL. */
export const appBase = (): string => {
  const base = import.meta.env.BASE_URL || "/";
  return base.endsWith("/") ? base : `${base}/`;
};

/**
 * A path inside this app, without its base: appPath("sign-in") is "/sign-in" in both apps.
 * React Router adds the base (basename) to redirects and links itself.
 */
export const appPath = (path: string): string => `/${path.replace(/^\//, "")}`;

/** A request's path inside the app: "/admin/users?x=1" is "/users?x=1" in the admin app. */
export const pathInApp = (url: URL): string => {
  const base = appBase();
  const inside = url.pathname.startsWith(base)
    ? `/${url.pathname.slice(base.length)}`
    : url.pathname;
  return inside + url.search;
};

/**
 * Where to go after sign-in, as a path inside the app. Anything else (another site, a
 * protocol-relative link, a backslash trick) falls back to the app's start.
 */
export const safeNext = (raw: FormDataEntryValue | null | string | undefined): string => {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\"))
    return "/";
  return raw;
};
