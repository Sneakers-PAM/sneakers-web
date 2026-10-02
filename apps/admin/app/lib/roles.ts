import type { UserFieldsFragment } from "@sneakers-web/api-client";

/** The roles that make someone a site admin. Identity treats both alike. */
export const SITE_ADMIN_ROLES = ["site-admin", "admin"];

/** Prior secret values and restores (the recovery view). Only a site admin can grant it. */
export const RECOVERY_ROLE = "recovery";

export const isSiteAdmin = (u: Pick<UserFieldsFragment, "isRoot" | "roles">): boolean =>
  u.isRoot || u.roles.some((r) => SITE_ADMIN_ROLES.includes(r));

/** The roles as people read them in the users list. */
export const roleLabels = (u: Pick<UserFieldsFragment, "isRoot" | "roles">): string[] => {
  const labels: string[] = [];
  if (isSiteAdmin(u)) labels.push("Site admin");
  if (u.roles.includes(RECOVERY_ROLE)) labels.push("Recovery");
  for (const r of u.roles) {
    if (![...SITE_ADMIN_ROLES, RECOVERY_ROLE, "user"].includes(r)) labels.push(r);
  }
  return labels.length > 0 ? labels : ["Member"];
};

/** The role list with one role switched on or off. */
export const withRole = (roles: string[], role: string, on: boolean): string[] => {
  const rest = roles.filter((r) =>
    role === "site-admin" ? !SITE_ADMIN_ROLES.includes(r) : r !== role,
  );
  return on ? [...rest, role] : rest;
};
