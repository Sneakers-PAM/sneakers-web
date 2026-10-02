import { TriangleAlert } from "lucide-react";

import { useRootData } from "#shell/root/useRootData";

/**
 * The banner a mock build pins to the top of every screen. The text comes from the edge
 * the server was built with; a live build has none, so nothing renders.
 */
export const EdgeBanner = () => {
  const { banner } = useRootData();
  if (!banner) return null;
  return (
    <div
      className="env-hatch flex flex-none items-center justify-center gap-2 border-b-[1.5px] border-ink px-4 py-1.5 font-mono text-[0.75rem] font-bold tracking-[0.08em] text-ink uppercase"
      data-testid="edge-banner"
      role="note"
    >
      <TriangleAlert aria-hidden className="size-3.5" />
      {banner}
    </div>
  );
};
