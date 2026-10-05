import { settings } from "#mock/admin/settings";
import { mockState } from "#mock/state";

/**
 * Whether a reveal in this folder needs a fresh second factor, as the vault decides it: the
 * nearest folder (this one, then up the tree) that sets require or off wins, else the global
 * "MFA before a reveal" setting.
 */
export const revealStepUpRequired = (folderId: string): boolean => {
  const folders = mockState.world.folders;
  for (let f = folders.find((x) => x.id === folderId); f;) {
    if (f.revealStepUp === "require") return true;
    if (f.revealStepUp === "off") return false;
    const parentId = f.parentId;
    f = parentId ? folders.find((x) => x.id === parentId) : undefined;
  }
  return settings.security.requireMfaForReveal;
};
