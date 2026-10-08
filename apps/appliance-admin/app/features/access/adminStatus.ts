import { clockTime, shortDate } from "@sneakers-web/ui";

import type { Admin } from "@/lib/osadmin/types";

export interface AdminStatus {
  label: string;
  locked: boolean;
  tone: "neutral" | "ok" | "warn";
}

/** An admin's sign-in state in a few words: an open invitation, a lockout, or active. */
export const adminStatus = (admin: Admin, now = Date.now()): AdminStatus => {
  if (admin.lockedUntilUnlocked)
    return { label: "Locked until an owner unlocks", locked: true, tone: "warn" };
  if (admin.lockedUntil && Date.parse(admin.lockedUntil) > now)
    return { label: `Locked until ${clockTime(admin.lockedUntil)}`, locked: true, tone: "warn" };
  if (admin.credentialsSet === false) {
    if (admin.inviteExpires && Date.parse(admin.inviteExpires) > now)
      return {
        label: `Invitation open until ${shortDate(admin.inviteExpires)} ${clockTime(admin.inviteExpires)}`,
        locked: false,
        tone: "neutral",
      };
    return { label: "Invitation expired", locked: false, tone: "warn" };
  }
  return { label: "Active", locked: false, tone: "ok" };
};
