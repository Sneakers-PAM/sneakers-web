import { cn, pillVariants } from "@sneakers-web/ui";

/**
 * A version that has to stand out on its own line: the running one in the primary tone, a
 * staged one in the quieter neutral tone. The words around it ("Running", "Staged") stay, so
 * the colour is never the only signal.
 */
export const VersionChip = ({ kind, version }: { kind: "running" | "staged"; version: string }) => (
  <span
    className={cn(pillVariants({ tone: kind === "running" ? "primary" : "neutral" }), "font-mono")}
    data-version={kind}
  >
    {version}
  </span>
);
