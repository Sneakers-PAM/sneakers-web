import { Button, cn, pillVariants } from "@sneakers-web/ui";

import { shortLabel } from "@/components/updates/shortLabel";

/**
 * A version that has to stand out on its own line: the running one in the primary tone, a
 * staged one in the quieter neutral tone. The words around it ("Running", "Staged") stay, so
 * the colour is never the only signal. A long build version (a lab build especially) shows a
 * short label instead, capped so it never forces the pill past the card: the full version sits
 * in the pill's tooltip and, once there's more to see, in a copyable monospace line below it.
 */
export const VersionChip = ({ kind, version }: { kind: "running" | "staged"; version: string }) => {
  const short = shortLabel(version);
  return (
    <span className="inline-flex max-w-full flex-col items-start gap-1">
      <span
        className={cn(
          pillVariants({ tone: kind === "running" ? "primary" : "neutral" }),
          "max-w-[22ch] truncate font-mono",
        )}
        data-version={kind}
        title={version}
      >
        {short}
      </span>
      {short !== version && (
        <details>
          <summary className="cursor-pointer text-small text-muted select-none">
            Full version
          </summary>
          <p className="m-0 mt-1 flex flex-wrap items-center gap-2">
            <code className="font-mono break-all">{version}</code>
            <Button
              onClick={() => void navigator.clipboard.writeText(version)}
              size="sm"
              variant="secondary"
            >
              Copy
            </Button>
          </p>
        </details>
      )}
    </span>
  );
};
