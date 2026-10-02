import { edge } from "@sneakers-web/edge";
import { TriangleAlert } from "lucide-react";

/**
 * The banner a mock build pins to the top of every screen. It reads the edge the build
 * was made with; a live build has no banner text, so nothing renders.
 */
export const EdgeBanner = () => {
  if (!edge.banner) return null;
  return (
    <div
      className="env-hatch flex flex-none items-center justify-center gap-2 border-b-[1.5px] border-ink px-4 py-1.5 font-mono text-[0.75rem] font-bold tracking-[0.08em] text-ink uppercase"
      data-testid="edge-banner"
      role="note"
    >
      <TriangleAlert aria-hidden className="size-3.5" />
      {edge.banner}
    </div>
  );
};
