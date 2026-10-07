/**
 * The route's path pattern (e.g. "/secret/:id"), not the concrete URL: `pathname` with each
 * matched param's id swapped back for its `:key` placeholder.
 */
export const routePattern = (
  pathname: string,
  parameters: Readonly<Record<string, string>>,
): string => {
  let pattern = pathname;
  for (const [key, value] of Object.entries(parameters)) {
    if (!value) continue;
    pattern = pattern.split(value).join(`:${key}`);
  }
  return pattern;
};

/**
 * The bundle's `path`: the route pattern, or "*" when no route matched (the splat route, or
 * no match at all), so an unmatched URL is never copied as typed.
 */
export const issuePath = (
  pathname: string | undefined,
  parameters: Readonly<Record<string, string>>,
): string => {
  if (pathname === undefined || "*" in parameters) return "*";
  return routePattern(pathname, parameters);
};
