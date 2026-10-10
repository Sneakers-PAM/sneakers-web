import { Button } from "@sneakers-web/ui";

import { Advanced } from "@/components/Advanced";

/**
 * A build or patch file's name, collapsed behind "Files": a generated name (a lab build's
 * especially) can run well past a card's width, so it sits in its own monospace line with a
 * copy button instead of inside a title or a sentence that can't wrap.
 */
export const FileDetails = ({ fileName }: { fileName: string }) => (
  <Advanced label="Files">
    <p className="m-0 flex flex-wrap items-center gap-2">
      <code className="font-mono break-all">{fileName}</code>
      <Button
        onClick={() => void navigator.clipboard.writeText(fileName)}
        size="sm"
        variant="secondary"
      >
        Copy
      </Button>
    </p>
  </Advanced>
);
