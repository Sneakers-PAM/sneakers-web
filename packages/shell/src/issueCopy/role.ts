/** The one role the UI issue bundle names: "root", else the user's first role, else none. */
export const primaryRole = (user: { isRoot: boolean; roles: readonly string[] }): string =>
  user.isRoot ? "root" : (user.roles[0] ?? "");
