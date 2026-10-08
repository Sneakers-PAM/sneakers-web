// The box's phase, from StatusService.GetPhase (public): "firstboot" until setup's Finish, then
// "normal". Once the box says normal it stays normal for this page's life: only a factory
// reset takes a box back to first boot, and that restarts it.
import { status } from "@/lib/osadmin/client";

export type Phase = "firstboot" | "normal";

let normal = false;

/** The phase, or undefined when the box doesn't answer. */
export const getPhase = async (): Promise<Phase | undefined> => {
  if (normal) return "normal";
  try {
    const { phase } = await status.getPhase();
    if (phase === "normal") normal = true;
    return phase === "normal" || phase === "firstboot" ? phase : undefined;
  } catch {
    return undefined;
  }
};

/** Whether the box has said setup is done. */
export const knownNormal = (): boolean => normal;

/** Forgets the phase (tests, between mock worlds). */
export const resetPhase = (): void => {
  normal = false;
};
