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
