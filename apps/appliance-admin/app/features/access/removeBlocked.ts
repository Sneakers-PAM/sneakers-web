import type { Admin } from "@/lib/osadmin/types";

const isOwner = (admin: Admin): boolean => admin.role === "ROLE_OWNER";

/**
 * Why Remove admin is off for `admin`, or undefined when it's allowed. Nobody removes their own
 * account, and the box refuses to lose its last owner (ACCESS_LAST_OWNER), so the page says so
 * before the click rather than after.
 */
export const removeBlocked = (
  admin: Admin,
  admins: Admin[],
  self: string | undefined,
): string | undefined => {
  const lastOwner = isOwner(admin) && !admins.some((a) => a.name !== admin.name && isOwner(a));
  if (admin.name === self)
    return lastOwner
      ? "You can't remove your own account, and at least one owner must remain."
      : "You can't remove your own account. Another owner can.";
  if (lastOwner) return "At least one owner must remain.";
  return undefined;
};
